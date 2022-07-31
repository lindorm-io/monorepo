import { DefaultLindormEventDomainSocketMiddleware } from "../types";
import { EventSource } from "@lindorm-io/event-source";
import { getSocketError } from "@lindorm-io/koa";

export const socketEventSourceMiddleware =
  (app: EventSource): DefaultLindormEventDomainSocketMiddleware =>
  (socket, next) => {
    try {
      socket.ctx.eventSource = app;
      socket.ctx.logger.debug("Event Source added to context");
      next();
    } catch (err) {
      next(getSocketError(socket, err));
    }
  };
