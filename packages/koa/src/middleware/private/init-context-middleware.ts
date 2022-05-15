import { Middleware } from "../../types";

export const initContextMiddleware: Middleware = async (ctx, next): Promise<void> => {
  ctx.axios = {};
  ctx.cache = {};
  ctx.connection = {};
  ctx.entity = {};
  ctx.keys = [];
  ctx.metrics = {};
  ctx.repository = {};
  ctx.token = {};

  await next();
};
