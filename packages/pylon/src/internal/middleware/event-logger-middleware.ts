import { PylonSocketMiddleware } from "../../types";

export const eventLoggerMiddleware: PylonSocketMiddleware = async (ctx, next) => {
  const start = Date.now();

  try {
    ctx.logger.info("Socket event received", {
      event: ctx.event,
      args: ctx.args,
    });

    await next();

    ctx.logger.info("Socket event resolved", {
      event: ctx.event,
      args: ctx.args,
      time: Date.now() - start,
    });
  } catch (err: any) {
    ctx.logger.error(err);
  }
};
