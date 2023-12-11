import { ServerKoaMiddleware } from "../../types";

export const accessControlMiddleware: ServerKoaMiddleware = async (ctx, next) => {
  ctx.set("Access-Control-Allow-Credentials", "true");
  ctx.set("Access-Control-Allow-Headers", "*");
  ctx.set("Access-Control-Allow-Methods", "*");
  ctx.set("Access-Control-Allow-Origin", "http://localhost:4100");
  ctx.set("Cache-Control", "no-cache");
  await next();
};
