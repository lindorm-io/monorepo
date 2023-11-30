import { Logger } from "@lindorm-io/core-logger";
import { Middleware } from "../../types";

export const axiosDefaultRequestLogger =
  (logger: Logger): Middleware =>
  async (ctx, next) => {
    const log = logger.createChildLogger(["Axios", ...(ctx.app.alias ? [ctx.app.alias] : [])]);

    log.verbose("Request initialised", {
      app: ctx.app,
      request: ctx.req,
    });

    await next();
  };
