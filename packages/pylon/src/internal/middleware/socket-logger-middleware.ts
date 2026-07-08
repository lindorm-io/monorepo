import type { PylonSocketMiddleware } from "../../types/index.js";

export const socketLoggerMiddleware: PylonSocketMiddleware = async (ctx, next) => {
  const start = Date.now();

  ctx.logger.debug("Socket event received", {
    event: ctx.event,
    args: ctx.args,
  });

  await next();

  ctx.logger.debug("Socket event resolved", {
    event: ctx.event,
    args: ctx.args,
    time: Date.now() - start,
  });
};
