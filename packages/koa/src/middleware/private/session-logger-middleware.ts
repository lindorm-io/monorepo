import { DefaultLindormMiddleware } from "../../types";
import { Logger } from "@lindorm-io/core-logger";

export const sessionLoggerMiddleware =
  (logger: Logger): DefaultLindormMiddleware =>
  async (ctx, next): Promise<void> => {
    ctx.logger = logger.createSessionLogger({
      correlationId: ctx.metadata.identifiers.correlationId,
      requestId: ctx.metadata.identifiers.requestId,
    });

    try {
      ctx.logger.info("Service request", {
        correlationId: ctx.metadata.identifiers.correlationId,
        requestId: ctx.metadata.identifiers.requestId,
        request: {
          body: ctx.request.body,
          header: ctx.request.header,
          metadata: ctx.metadata,
          method: ctx.request.method,
          params: ctx.params,
          query: ctx.query,
          url: ctx.request.url,
        },
      });

      await next();
    } finally {
      ctx.logger.info("Service response", {
        correlationId: ctx.metadata.identifiers.correlationId,
        requestId: ctx.metadata.identifiers.requestId,
        response: {
          body: ctx.response.body,
          config: ctx.config,
          header: ctx.response.header,
          message: ctx.response.message,
          metrics: ctx.metrics,
          server: ctx.server,
          status: ctx.response.status,
        },
      });
    }
  };
