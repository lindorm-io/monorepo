import type { PylonHttpMiddleware } from "../../../types/index.js";

export const errorHandler: PylonHttpMiddleware = async (ctx) => {
  ctx.body = ctx.query;
  ctx.status = 400;
};
