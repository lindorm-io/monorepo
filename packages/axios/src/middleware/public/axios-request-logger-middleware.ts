import { Logger } from "@lindorm-io/core-logger";
import { AxiosError } from "axios";
import { Middleware } from "../../types";
import { getResponseTime } from "../../util/private";

export const axiosRequestLoggerMiddleware =
  (logger: Logger): Middleware =>
  async (ctx, next) => {
    const log = logger.createChildLogger(["Axios", ...(ctx.app.alias ? [ctx.app.alias] : [])]);
    const start = Date.now();

    try {
      log.verbose("Request initialised", {
        req: ctx.req,
      });

      await next();

      log.verbose("Request successful", {
        app: ctx.app,
        req: ctx.req,
        res: {
          data: ctx.res?.data,
          headers: ctx.res?.headers,
          status: ctx.res?.status,
          statusText: ctx.res?.statusText,
        },
        time: getResponseTime(ctx.res?.headers, start),
      });
    } catch (err: any) {
      if (!(err instanceof AxiosError)) {
        log.error("Request exception", err);

        throw err;
      }

      log.warn("Request failed", {
        code: err.code,
        config: err.config,

        app: ctx.app,
        req: ctx.req,
        res: {
          data: err.response?.data,
          headers: err.response?.headers,
          status: err.response?.status || err.status,
          statusText: err.response?.statusText,
        },
        time: getResponseTime(ctx.res?.headers, start),
      });

      throw err;
    }
  };
