import { PylonHttpMiddleware } from "../../types";

export const httpSetCookieMiddleware: PylonHttpMiddleware = async (ctx, next) => {
  await next();

  const header = ctx.cookies.toHeader();

  if (header.length) {
    ctx.set("set-cookie", header);
  }
};
