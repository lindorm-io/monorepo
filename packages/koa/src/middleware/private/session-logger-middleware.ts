import { Logger } from "@lindorm-io/core-logger";
import { DefaultLindormMiddleware } from "../../types";

export const sessionLoggerMiddleware =
  (logger: Logger): DefaultLindormMiddleware =>
  async (ctx, next): Promise<void> => {
    ctx.logger = logger.createSessionLogger({
      correlationId: ctx.metadata.correlationId,
      requestId: ctx.metadata.requestId,
    });

    try {
      ctx.logger.info("Service received request", {
        correlationId: ctx.metadata.correlationId,
        requestId: ctx.metadata.requestId,
        request: {
          body: ctx.request.body,
          header: ctx.request.header,
          metadata: ctx.metadata,
          method: ctx.request.method,
          params: ctx.params,
          query: ctx.query,
          url: ctx.request.url,
          userAgent: {
            browser: ctx.userAgent.browser,
            geoIp: ctx.userAgent.geoIp,
            os: ctx.userAgent.os,
            platform: ctx.userAgent.platform,
            source: ctx.userAgent.source,
            version: ctx.userAgent.version,
          },
        },
      });

      await next();

      ctx.logger.info("Service responded with success", {
        correlationId: ctx.metadata.correlationId,
        requestId: ctx.metadata.requestId,
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
    } catch (err) {
      ctx.logger.warn("Service responded with error", {
        correlationId: ctx.metadata.correlationId,
        requestId: ctx.metadata.requestId,
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
