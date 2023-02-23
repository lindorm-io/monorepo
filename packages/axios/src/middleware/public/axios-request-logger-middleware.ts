import { AxiosError } from "axios";
import { Logger } from "@lindorm-io/core-logger";
import { Middleware } from "../../types";
import { getResponseTime } from "../../util/private";

export const axiosRequestLoggerMiddleware =
  (logger: Logger): Middleware =>
  async (ctx, next) => {
    const log = logger.createChildLogger(["Axios", ctx.app.clientName]);
    const start = Date.now();

    try {
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
        log.error("Unexpected error", err);

        throw err;
      }

      log.error("Request failed", {
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
