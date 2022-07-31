import { DefaultLindormEventDomainKoaMiddleware } from "../types";
import { EventSource } from "@lindorm-io/event-source";
import { ServerError } from "@lindorm-io/errors";

export const eventSourceMiddleware =
  (app: EventSource): DefaultLindormEventDomainKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("mongo");

    if (!app.isInitialised) {
      throw new ServerError("EventSource has not been initialised");
    }

    ctx.eventSource = app;

    ctx.logger.debug("Event Source added to context");

    metric.end();

    await next();
  };
