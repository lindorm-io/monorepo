import { isArray } from "@lindorm/is";
import { HttpMethod } from "@lindorm/types";
import { CorsError } from "../../errors";
import { CorsOptions, PylonHttpMiddleware } from "../../types";
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
} from "../../utils/private";

export const createHttpCorsMiddleware = (
  options: CorsOptions = {},
): PylonHttpMiddleware => {
  if (options.allowOrigins === "*" && options.allowCredentials) {
    throw new Error("Cannot set allowCredentials to true when allowOrigins is set to *");
  }

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
