import { Middleware } from "../../types";

export const axiosBearerAuthMiddleware =
  (accessToken: string): Middleware =>
  async (ctx, next) => {
    ctx.req.config.auth = undefined;

    ctx.req.headers = {
      ...ctx.req.headers,
      Authorization: `Bearer ${accessToken}`,
    };

    await next();
  };
