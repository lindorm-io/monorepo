import { isArray } from "@lindorm/is";
import type { HttpMethod } from "@lindorm/types";
import { CorsError } from "../../errors/index.js";
import type { CorsOptions, PylonHttpMiddleware } from "../../types/index.js";
import { validateCorsOptions } from "../utils/cors/validate-cors-options.js";
import {
  handleAccessControlCredentials,
  handleAccessControlExposeHeaders,
  handleAccessControlHeaders,
  handleAccessControlMaxAge,
  handleAccessControlMethods,
  handleAccessControlOrigin,
  handleAccessControlPrivateNetwork,
  handleCrossOriginEmbedderPolicy,
  handleCrossOriginOpenerPolicy,
} from "../utils/cors-handlers.js";

export const createHttpCorsMiddleware = (
  options: CorsOptions = {},
): PylonHttpMiddleware => {
  validateCorsOptions(options);

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
    if (ctx.method.toLowerCase() !== "options") {
      return await next();
    }

    ctx.vary("Origin");

    try {
      const originHeader = handleAccessControlOrigin(ctx, options);

      if (originHeader) {
        handleAccessControlCredentials(ctx, options);
        handleAccessControlExposeHeaders(ctx, options);
        handleAccessControlHeaders(ctx, options);
        handleAccessControlMaxAge(ctx, options);
        handleAccessControlMethods(ctx, options);
        handleAccessControlPrivateNetwork(ctx, options);
      }

      handleCrossOriginEmbedderPolicy(ctx, options);
      handleCrossOriginOpenerPolicy(ctx, options);
    } catch (error) {
      if (error instanceof CorsError) {
        ctx.status = error.status;
        ctx.body = error.message;

        return;
      }

      throw error;
    }

    ctx.status = 204;
  };
};
