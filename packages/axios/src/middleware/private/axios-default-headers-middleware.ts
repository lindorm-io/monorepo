import { Middleware } from "../../types";

export const axiosDefaultHeadersMiddleware: Middleware = async (ctx, next) => {
  ctx.req.headers["Date"] = new Date().toUTCString();
  ctx.req.headers["X-Request-ID"] = ctx.req.requestId;
  ctx.req.headers["X-Correlation-ID"] = ctx.req.correlationId;

  await next();
};
