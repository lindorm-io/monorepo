import type { PylonHttpMiddleware } from "../../types/index.js";

export const httpResponseTimeMiddleware: PylonHttpMiddleware = async (ctx, next) => {
  const start = Date.now();

  try {
    await next();
  } finally {
    const end = Date.now();

    ctx.set("date", new Date().toUTCString());
    ctx.set("x-start-time", start.toString());
    ctx.set("x-current-time", end.toString());
    ctx.set("x-response-time", `${end - start}ms`);
  }
};
