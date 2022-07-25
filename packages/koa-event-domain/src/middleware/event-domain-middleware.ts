import { DefaultLindormEventDomainKoaMiddleware } from "../types";
import { EventDomainApp } from "@lindorm-io/event-domain";
import { ServerError } from "@lindorm-io/errors";

export const eventDomainMiddleware =
  (app: EventDomainApp): DefaultLindormEventDomainKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("mongo");

    if (!app.isInitialised) {
      throw new ServerError("EventDomainApp has not been initialised");
    }

    ctx.eventDomain = app;

    ctx.logger.debug("Event Domain added to context");

    metric.end();

    await next();
  };
