import { DefaultLindormMiddleware } from "../../types";
import { ILogger } from "@lindorm-io/winston";

export const sessionLoggerMiddleware =
  (winston: ILogger): DefaultLindormMiddleware =>
  async (ctx, next): Promise<void> => {
    ctx.logger = winston.createSessionLogger({
      correlationId: ctx.metadata.identifiers.correlationId,
      fingerprint: ctx.metadata.identifiers.fingerprint,
    });

    try {
      await next();
    } finally {
      ctx.logger.info("service response", {
        request: {
          body: ctx.request.body,
          header: ctx.request.header,
          metadata: ctx.metadata,
          method: ctx.request.method,
          params: ctx.params,
          query: ctx.query,
          url: ctx.request.url,
        },
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
