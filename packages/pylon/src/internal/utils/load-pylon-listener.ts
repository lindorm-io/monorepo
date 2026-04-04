import { composeMiddleware } from "@lindorm/middleware";
import { PylonListener } from "../../classes";
import {
  IoServer,
  PylonListenerMethod,
  PylonSocket,
  PylonSocketContext,
  PylonSocketMiddleware,
} from "../../types";
import { EventMatcher, EventSegment } from "../classes/EventMatcher";
import { composePylonSocketContextBase } from "./compose-pylon-socket-context";

type DynamicEntry<C extends PylonSocketContext> = {
  middleware: Array<PylonSocketMiddleware<C>>;
  method: PylonListenerMethod;
};

const buildPrefixSegments = (prefix: string): Array<EventSegment> =>
  prefix.split(":").map((p) => ({ type: "literal" as const, value: p }));

export const loadPylonListeners = <C extends PylonSocketContext>(
  io: IoServer,
  socket: PylonSocket,
  middleware: Array<PylonSocketMiddleware<C>>,
  listeners: Array<PylonListener<C>>,
): void => {
  const matcher = new EventMatcher<DynamicEntry<C>>();
  let hasDynamic = false;

  for (const listener of listeners) {
    for (const item of listener.listeners) {
      const { event: listenerEvent, method, listeners: handlers, segments } = item;

      const allMiddleware: Array<PylonSocketMiddleware<C>> = [
        ...middleware,
        ...listener.middleware,
        ...handlers,
      ];

      const isDynamic = segments && matcher.hasParams(segments);

      if (isDynamic) {
        // Dynamic event — add to trie with prefix segments prepended
        const fullSegments = listener.prefix
          ? [...buildPrefixSegments(listener.prefix), ...segments]
          : segments;

        matcher.add(fullSegments, { middleware: allMiddleware, method });
        hasDynamic = true;
      } else {
        // Static event — register directly on socket
        const event = listener.prefix
          ? `${listener.prefix}:${listenerEvent}`
          : listenerEvent;

        if (method === "on" || method === "once") {
          socket[method](event, async (...args: Array<any>) => {
            const ctx = composePylonSocketContextBase(io, socket, { args, event });
            await composeMiddleware<any>(ctx, allMiddleware, { useClone: false });
          });
        } else {
          socket[method](async (event, ...args: Array<any>) => {
            const ctx = composePylonSocketContextBase(io, socket, { args, event });
            await composeMiddleware<any>(ctx, allMiddleware, { useClone: false });
          });
        }
      }
    }
  }

  if (hasDynamic) {
    const onceFired = new Set<string>();

    socket.onAny(async (event: string, ...args: Array<any>) => {
      const result = matcher.match(event);
      if (!result) return;

      for (const entry of result.data) {
        if (entry.method === "once") {
          const key = `once:${event}`;
          if (onceFired.has(key)) continue;
          onceFired.add(key);
        }

        const ctx = composePylonSocketContextBase(io, socket, { args, event });
        ctx.params = result.params;

        await composeMiddleware<any>(ctx, entry.middleware, { useClone: false });
      }
    });
  }
};
