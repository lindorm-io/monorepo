import type { ConduitMiddleware } from "../types/index.js";

export const conduitBearerAuthMiddleware = (
  accessToken: string,
  tokenType: string = "Bearer",
): ConduitMiddleware =>
  async function conduitBearerAuthMiddleware(ctx, next) {
    ctx.req.headers = {
      ...ctx.req.headers,
      Authorization: `${tokenType} ${accessToken}`,
    };

    await next();
  };
