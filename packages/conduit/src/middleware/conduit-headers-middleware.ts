import { Dict } from "@lindorm/types";
import { ConduitMiddleware } from "../types";

export const conduitHeadersMiddleware = (headers: Dict<string>): ConduitMiddleware =>
  async function conduitHeadersMiddleware(ctx, next) {
    ctx.req.headers = { ...ctx.req.headers, ...headers };

    await next();
  };
