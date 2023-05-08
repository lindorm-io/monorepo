import { Middleware } from "../../types";

export const axiosDefaultHeadersMiddleware: Middleware = async (ctx, next) => {
  ctx.req.headers["x-request-id"] = ctx.req.requestId;
  ctx.req.headers["x-correlation-id"] = ctx.req.correlationId;

  await next();
};
