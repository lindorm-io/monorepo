import { DefaultLindormEventDomainSocketMiddleware } from "../types";
import { IEventSource } from "@lindorm-io/event-source";
import { getSocketError } from "@lindorm-io/koa";
import { ServerError } from "@lindorm-io/errors";

export const socketEventSourceMiddleware =
  (app: IEventSource): DefaultLindormEventDomainSocketMiddleware =>
  (socket, next) => {
    try {
      if (!app.isInitialised) {
        throw new ServerError("EventSource has not been initialised");
      }

      socket.ctx.eventSource = {
        command: (command, options) =>
          app.command(command, {
            metadata: {
              trace: socket.ctx.token?.bearerToken?.subject ? "identity" : "koa",
              subject: socket.ctx.token?.bearerToken?.subject,
              ...(options.metadata || {}),
            },
            ...options,
          }),
        query: (query) => app.query(query),
        admin: app.admin,
      };

      socket.ctx.logger.debug("Event Source added to context");
      next();
    } catch (err) {
      next(getSocketError(socket, err));
    }
  };
