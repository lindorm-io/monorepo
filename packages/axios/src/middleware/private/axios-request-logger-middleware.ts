import { AxiosError } from "axios";
import { Middleware } from "../../types";
import { getResponseTime } from "../../util";

export const axiosRequestLoggerMiddleware: Middleware = async (ctx, next) => {
  const start = Date.now();

  try {
    await next();

    ctx.logger.verbose("axios successful", {
      config: ctx.res.config,
      request: {
        data: ctx.req.body,
        headers: ctx.req.headers,
        params: ctx.req.params,
        query: ctx.req.query,
      },
      response: {
        data: ctx.res.data,
        headers: ctx.res.headers,
        status: ctx.res.status,
        statusText: ctx.res.statusText,
      },
      time: getResponseTime(ctx.res.headers, start),
    });
  } catch (err) {
    if (!(err instanceof AxiosError)) {
      ctx.logger.error("unexpected error", err);

      throw err;
    }

    ctx.logger.error("axios failed", {
      code: err.code,
      config: err.config,
      request: {
        data: ctx.req.body,
        headers: ctx.req.headers,
        params: ctx.req.params,
        query: ctx.req.query,
      },
      response: {
        data: err.response?.data,
        headers: err.response?.headers,
        status: err.response?.status || err.status,
        statusText: err.response?.statusText,
      },
      time: getResponseTime(ctx.res.headers, start),
    });

    throw err;
  }
};
