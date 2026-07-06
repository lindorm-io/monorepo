import { isArray } from "@lindorm/is";
import type { ILogger } from "@lindorm/logger";
import type { HttpMethod } from "@lindorm/types";
import { CorsError } from "../../errors/index.js";
import type { CorsOptions, PylonHttpMiddleware } from "../../types/index.js";
import { normaliseAllowHeaders } from "../utils/cors/normalise-allow-headers.js";
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
  logger?: ILogger,
): PylonHttpMiddleware => {
  validateCorsOptions(options);

  options.allowMethods = isArray(options.allowMethods)
    ? options.allowMethods.map((m) => m.toUpperCase() as HttpMethod)
    : options.allowMethods;

  options.allowHeaders = isArray(options.allowHeaders)
    ? normaliseAllowHeaders(
        options.allowHeaders.map((h) => h.toLowerCase()),
        logger,
      )
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
    ctx.vary("Origin");

    const preflight = ctx.method.toUpperCase() === "OPTIONS";

    try {
      const originAllowed = handleAccessControlOrigin(ctx, options);

      // Access-Control-Allow-Origin (+ credentials + exposed headers) must ride
      // on the ACTUAL response too — not just the preflight — or the browser
      // discards every real cross-origin response.
      if (originAllowed) {
        handleAccessControlCredentials(ctx, options);
        handleAccessControlExposeHeaders(ctx, options);

        // allow-methods / allow-headers / max-age / private-network only mean
        // anything on the OPTIONS preflight — reserve them for it.
        if (preflight) {
          handleAccessControlHeaders(ctx, options);
          handleAccessControlMaxAge(ctx, options);
          handleAccessControlMethods(ctx, options);
          handleAccessControlPrivateNetwork(ctx, options);
        }
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

    if (preflight) {
      ctx.status = 204;

      return;
    }

    return await next();
  };
};
