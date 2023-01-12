import { AxiosError } from "axios";
import { Middleware } from "../types";
import { getResponseTime } from "../util";
import { Logger } from "@lindorm-io/core-logger";

export const axiosRequestLoggerMiddleware =
  (logger: Logger): Middleware =>
  async (ctx, next) => {
    const log = logger.createChildLogger(ctx.axios.name ? ["Axios", ctx.axios.name] : "Axios");
    const start = Date.now();

    try {
      await next();

      log.verbose("axios successful", {
        axios: ctx.axios,
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
        log.error("unexpected error", err);

        throw err;
      }

      log.error("axios failed", {
        axios: ctx.axios,
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
