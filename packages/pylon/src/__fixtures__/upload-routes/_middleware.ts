import type { PylonHttpMiddleware } from "../../types/index.js";

export const uploadRootMiddleware: PylonHttpMiddleware = async (ctx, next) => {
  ctx.set("X-Upload-Root-Middleware", "1");
  await next();
};

export const MIDDLEWARE = uploadRootMiddleware;
