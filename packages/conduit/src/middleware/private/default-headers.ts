import { ConduitMiddleware } from "../../types";

export const _defaultHeaders: ConduitMiddleware = async (ctx, next) => {
  ctx.req.headers["Date"] = ctx.req.metadata.date.toUTCString();
  ctx.req.headers["X-Correlation-Id"] = ctx.req.metadata.correlationId;
  ctx.req.headers["X-Request-Id"] = ctx.req.metadata.requestId;

  if (ctx.app.environment) {
    ctx.req.headers["X-Environment"] = ctx.app.environment;
  }

  await next();
};
