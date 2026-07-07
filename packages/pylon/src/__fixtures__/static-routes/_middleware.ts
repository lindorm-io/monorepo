import type { PylonHttpMiddleware } from "../../types/index.js";

export const staticRootMiddleware: PylonHttpMiddleware = async (ctx, next) => {
  ctx.set("X-Static-Root-Middleware", "1");
  await next();
};

export const MIDDLEWARE = staticRootMiddleware;
