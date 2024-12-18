import { HttpMethod } from "@lindorm/conduit";
import { isArray } from "@lindorm/is";
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
  options.allowMethods = isArray(options.allowMethods)
    ? options.allowMethods.map((m) => m.toUpperCase() as HttpMethod)
    : options.allowMethods;

  options.allowHeaders = isArray(options.allowHeaders)
    ? options.allowHeaders.map((h) => h.toLowerCase())
    : options.allowHeaders;

  options.allowOrigins = isArray(options.allowOrigins)
    ? options.allowOrigins
        .map((o) => o.toLowerCase())
        .map((o) => (o.endsWith("/") ? o.slice(0, -1) : o))
    : options.allowOrigins;

  options.exposeHeaders = isArray(options.exposeHeaders)
    ? options.exposeHeaders.map((h) => h.toLowerCase())
    : options.exposeHeaders;

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
