import { DefaultLindormEventDomainKoaMiddleware } from "../types";
import { IEventSource } from "@lindorm-io/event-source";
import { ServerError } from "@lindorm-io/errors";

export const eventSourceMiddleware =
  (app: IEventSource): DefaultLindormEventDomainKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("mongo");

    if (!app.isInitialised) {
      throw new ServerError("EventSource has not been initialised");
    }

    ctx.eventSource = {
      publish: (options) =>
        app.publish({
          correlationId: ctx.metadata.identifiers.correlationId,
          origin: ctx.token?.bearerToken?.subject ? "identity" : "koa",
          originator: ctx.token?.bearerToken?.subject || undefined,
          ...options,
        }),
      admin: app.admin,
      repositories: app.repositories,
    };

    ctx.logger.debug("Event Source added to context");

    metric.end();

    await next();
  };
