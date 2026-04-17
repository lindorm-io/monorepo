import type { ServerHttpMiddleware } from "../types/context";

export const exampleMiddleware: ServerHttpMiddleware = async (ctx, next) => {
  ctx.set("x-example-header", "true");

  await next();
};
