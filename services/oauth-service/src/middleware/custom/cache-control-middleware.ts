import { ServerKoaMiddleware } from "../../types";

export const cacheControlMiddleware: ServerKoaMiddleware = async (ctx, next) => {
  ctx.set("Cache-Control", "no-store");
  ctx.set("Pragma", "no-cache");

  await next();
};
