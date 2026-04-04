import { PylonSocketMiddleware } from "../../types";

export const socketLoggerMiddleware: PylonSocketMiddleware = async (ctx, next) => {
  const start = Date.now();

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
};
