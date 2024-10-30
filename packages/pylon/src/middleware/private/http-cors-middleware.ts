import { sec } from "@lindorm/date";
import { isArray, isFinite } from "@lindorm/is";
import { CorsOptions, PylonHttpMiddleware } from "../../types";

export const createHttpCorsMiddleware = (
  options: CorsOptions = {},
): PylonHttpMiddleware => {
  return async function httpCorsMiddleware(ctx, next) {
    ctx.vary("Origin");

    if (options.allowCredentials) {
      ctx.set("Access-Control-Allow-Credentials", options.allowCredentials.toString());
    }

    const requestHeaders = ctx.get("Access-Control-Request-Headers");
    if (options.allowHeaders || requestHeaders) {
      const opts = options.allowHeaders ?? requestHeaders;
      ctx.set("Access-Control-Allow-Headers", isArray(opts) ? opts.join(",") : "*");
    }

    const requestMethods = ctx.get("Access-Control-Request-Methods");
    if (options.allowMethods || requestMethods) {
      const opts = options.allowMethods ?? requestMethods;
      ctx.set("Access-Control-Allow-Methods", isArray(opts) ? opts.join(",") : "*");
    }

    const requestOrigin = ctx.get("Access-Control-Request-Origin");
    if (options.allowOrigins || requestOrigin) {
      const opts = options.allowOrigins ?? requestOrigin;
      ctx.set("Access-Control-Allow-Origin", isArray(opts) ? opts.join(",") : "*");
    }

    if (options.exposeHeaders) {
      ctx.set(
        "Access-Control-Expose-Headers",
        isArray(options.exposeHeaders) ? options.exposeHeaders.join(",") : "*",
      );
    }

    if (options.maxAge) {
      ctx.set(
        "Access-Control-Max-Age",
        isFinite(options.maxAge)
          ? options.maxAge.toString()
          : sec(options.maxAge).toString(),
      );
    }

    if (
      options.privateNetworkAccess &&
      ctx.get("Access-Control-Request-Private-Network")
    ) {
      ctx.set("Access-Control-Allow-Private-Network", "true");
    }

    if (options.secureContext) {
      ctx.set("Cross-Origin-Opener-Policy", "same-origin");
      ctx.set("Cross-Origin-Embedder-Policy", "require-corp");
    }

    await next();
  };
};
