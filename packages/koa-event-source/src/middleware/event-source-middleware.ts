import { DefaultLindormEventDomainKoaMiddleware } from "../types";
import { IEventSource } from "@lindorm-io/event-source";
import { ServerError } from "@lindorm-io/errors";

export const eventSourceMiddleware =
  (app: IEventSource): DefaultLindormEventDomainKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("eventSource");

    if (!app.isInitialised) {
      throw new ServerError("EventSource has not been initialised");
    }

    ctx.eventSource = {
      command: (command, options) =>
        app.command(command, {
          correlationId: ctx.metadata.identifiers.correlationId,
          metadata: {
            trace: ctx.token?.bearerToken?.subject ? "identity" : "koa",
            ...(ctx.token?.bearerToken?.subject ? { subject: ctx.token.bearerToken.subject } : {}),
            ...(options?.metadata || {}),
          },
          ...options,
        }),
      query: (query) => app.query(query),
      admin: app.admin,
    };

    ctx.logger.debug("Event Source added to context");

    metric.end();

    await next();
  };
