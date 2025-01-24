import { composeMiddleware } from "@lindorm/middleware";
import { PylonListener } from "../../classes";
import {
  IoServer,
  PylonSocket,
  PylonSocketContext,
  PylonSocketMiddleware,
} from "../../types";
import { composePylonSocketContextBase } from "./compose-pylon-socket-context";

export const loadPylonListeners = <C extends PylonSocketContext>(
  io: IoServer,
  socket: PylonSocket,
  middleware: Array<PylonSocketMiddleware<C>>,
  listeners: Array<PylonListener<C>>,
): void => {
  for (const listener of listeners) {
    for (const item of listener.listeners) {
      const { event: listenerEvent, method, listeners } = item;

      const event = listener.prefix
        ? `${listener.prefix}/${listenerEvent}`
        : listenerEvent;

      if (method === "on" || method === "once") {
        socket[method](event, async (...args: Array<any>) => {
          const ctx = composePylonSocketContextBase(io, socket, { args, event });

          const evtMiddleware: Array<PylonSocketMiddleware<C>> = [
            ...middleware,
            ...listener.middleware,
            ...listeners,
          ];

          await composeMiddleware<any>(ctx, evtMiddleware, { useClone: false });
        });
      } else {
        socket[method](async (event, ...args: Array<any>) => {
          const ctx = composePylonSocketContextBase(io, socket, { args, event });

          const evtMiddleware: Array<PylonSocketMiddleware<C>> = [
            ...middleware,
            ...listener.middleware,
            ...listeners,
          ];

          await composeMiddleware<any>(ctx, evtMiddleware, { useClone: false });
        });
      }
    }
  }
};
