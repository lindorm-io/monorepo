import { ConduitMiddleware } from "../types";

export const conduitBearerAuthMiddleware =
  (accessToken: string, tokenType: string = "Bearer"): ConduitMiddleware =>
  async (ctx, next) => {
    ctx.req.headers = {
      ...ctx.req.headers,
      Authorization: `${tokenType} ${accessToken}`,
    };

    await next();
  };
