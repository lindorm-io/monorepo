import { B64 } from "@lindorm/b64";
import type { ConduitMiddleware } from "../types/index.js";

export const conduitBasicAuthMiddleware = (
  username: string,
  password: string,
): ConduitMiddleware =>
  async function conduitBasicAuthMiddleware(ctx, next) {
    ctx.req.headers = {
      ...ctx.req.headers,
      Authorization: `Basic ${B64.encode(`${username}:${password}`)}`,
    };

    await next();
  };
