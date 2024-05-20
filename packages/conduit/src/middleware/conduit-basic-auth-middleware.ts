import { ConduitMiddleware } from "../types";

export const conduitBasicAuthMiddleware =
  (username: string, password: string): ConduitMiddleware =>
  async (ctx, next) => {
    ctx.req.headers = {
      ...ctx.req.headers,
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
    };

    await next();
  };
