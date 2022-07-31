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
        publish: app.publish,
        admin: app.admin,
        repositories: app.repositories,
      };

      socket.ctx.logger.debug("Event Source added to context");
      next();
    } catch (err) {
      next(getSocketError(socket, err));
    }
  };
