import { DefaultLindormEventDomainSocketMiddleware } from "../types";
import { EventDomainApp } from "@lindorm-io/event-domain";
import { getSocketError } from "@lindorm-io/koa";

export const socketEventDomainMiddleware =
  (app: EventDomainApp): DefaultLindormEventDomainSocketMiddleware =>
  (socket, next) => {
    try {
      socket.ctx.eventDomain = app;
      socket.ctx.logger.debug("Event Domain added to context");
      next();
    } catch (err) {
      next(getSocketError(socket, err));
    }
  };
