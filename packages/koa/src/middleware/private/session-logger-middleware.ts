import { DefaultLindormMiddleware } from "../../types";
import { Logger } from "@lindorm-io/core-logger";

export const sessionLoggerMiddleware =
  (logger: Logger): DefaultLindormMiddleware =>
  async (ctx, next): Promise<void> => {
    ctx.logger = logger.createSessionLogger({
      correlationId: ctx.metadata.identifiers.correlationId,

      ...(ctx.metadata.identifiers.fingerprint
        ? { fingerprint: ctx.metadata.identifiers.fingerprint }
        : {}),
    });

    try {
      ctx.logger.info("service request", {
        correlationId: ctx.metadata.identifiers.correlationId,
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
      ctx.logger.info("service response", {
        correlationId: ctx.metadata.identifiers.correlationId,
        response: {
          body: ctx.response.body,
          header: ctx.response.header,
          message: ctx.response.message,
          metrics: ctx.metrics,
          status: ctx.response.status,
        },
      });
    }
  };
