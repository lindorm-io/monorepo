import { ReadableTime, sec } from "@lindorm/date";
import { HttpMethod } from "@lindorm/enums";
import { isArray, isFinite } from "@lindorm/is";
import { PylonHttpMiddleware } from "../../types";

type Options = {
  allowCredentials?: boolean;
  allowHeaders?: "*" | Array<string>;
  allowMethods?: "*" | Array<HttpMethod>;
  allowOrigins?: "*" | Array<string>;
  exposeHeaders?: "*" | Array<string>;
  maxAge?: ReadableTime | number;
};

export const createHttpCorsMiddleware = (options: Options = {}): PylonHttpMiddleware => {
  return async function httpCorsMiddleware(ctx, next) {
    if (options.allowCredentials) {
      ctx.set("Access-Control-Allow-Credentials", options.allowCredentials.toString());
    }
    if (options.allowHeaders) {
      ctx.set(
        "Access-Control-Allow-Headers",
        isArray(options.allowHeaders) ? options.allowHeaders.join(",") : "*",
      );
    }
    if (options.allowMethods) {
      ctx.set(
        "Access-Control-Allow-Methods",
        isArray(options.allowMethods) ? options.allowMethods.join(",") : "*",
      );
    }
    if (options.allowOrigins) {
      ctx.set(
        "Access-Control-Allow-Origin",
        isArray(options.allowOrigins) ? options.allowOrigins.join(",") : "*",
      );
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

    await next();
  };
};
