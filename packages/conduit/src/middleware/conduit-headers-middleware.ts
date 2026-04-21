import type { Dict } from "@lindorm/types";
import type { ConduitMiddleware } from "../types/index.js";

export const conduitHeadersMiddleware = (headers: Dict<string>): ConduitMiddleware =>
  async function conduitHeadersMiddleware(ctx, next) {
    ctx.req.headers = { ...ctx.req.headers, ...headers };

    await next();
  };
