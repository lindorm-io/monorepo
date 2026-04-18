import type { ServerHttpMiddleware } from "../types/context";

export const httpExampleMiddleware: ServerHttpMiddleware = async (ctx, next) => {
  ctx.set("x-example-header", "true");

  await next();
};
