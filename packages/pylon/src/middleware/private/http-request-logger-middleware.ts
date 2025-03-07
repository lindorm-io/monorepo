import { PylonHttpMiddleware } from "../../types";

export const httpRequestLoggerMiddleware: PylonHttpMiddleware = async (ctx, next) => {
  ctx.logger.info("Service request", {
    metadata: ctx.metadata,
    request: {
      body: ctx.request.body,
      header: ctx.request.header,
      method: ctx.request.method,
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
};
