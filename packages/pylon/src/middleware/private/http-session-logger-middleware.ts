import { isObject, isString } from "@lindorm/is";
import { Stream } from "stream";
import { PylonHttpMiddleware } from "../../types";

export const httpSessionLoggerMiddleware: PylonHttpMiddleware = async (ctx, next) => {
  const start = Date.now();

  try {
    ctx.logger.info("Service request", {
      metadata: ctx.metadata,
      request: {
        body: ctx.request.body,
        data: ctx.data,
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

    ctx.logger.info("Service response", {
      metadata: ctx.metadata,
      request: {
        body: ctx.request.body,
        data: ctx.data,
        files: ctx.request.files,
        header: ctx.request.header,
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
      response: {
        body:
          isObject(ctx.response.body) || isString(ctx.response.body)
            ? ctx.response.body
            : ctx.response.body instanceof Stream
              ? "[Stream]"
              : ctx.response.body,
        headers: ctx.response.header,
        message: ctx.response.message,
        status: ctx.response.status,
      },
      time: Date.now() - start,
    });
  } catch (err: any) {
    ctx.logger.error(err);
  }
};
