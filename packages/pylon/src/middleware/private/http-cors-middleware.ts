import { CorsError } from "../../errors";
import { CorsMiddleware, CorsOptions } from "../../types";
import {
  handleAllowedCredentials,
  handleAllowedHeaders,
  handleAllowedMethods,
  handleAllowedOrigin,
  handleEmbedderPolicy,
  handleExposeHeaders,
  handleMaxAge,
  handleOpenerPolicy,
  handlePrivateNetworkAccess,
} from "../../utils/private";

export const createHttpCorsMiddleware = (options: CorsOptions = {}): CorsMiddleware => {
  return async function httpCorsMiddleware(ctx, next) {
    ctx.preflight = ctx.method === "OPTIONS";
    ctx.vary("Origin");

    try {
      handleAllowedCredentials(ctx, options);
      handleAllowedHeaders(ctx, options);
      handleAllowedMethods(ctx, options);
      handleAllowedOrigin(ctx, options);

      handleExposeHeaders(ctx, options);
      handleMaxAge(ctx, options);

      handleEmbedderPolicy(ctx, options);
      handleOpenerPolicy(ctx, options);
      handlePrivateNetworkAccess(ctx, options);
    } catch (error) {
      if (error instanceof CorsError) {
        ctx.status = error.status;
        ctx.body = error.message;

        return;
      }

      throw error;
    }

    if (ctx.preflight) {
      ctx.status = 204;
      return;
    }

    await next();
  };
};
