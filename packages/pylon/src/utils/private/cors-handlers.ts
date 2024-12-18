import { sec } from "@lindorm/date";
import { isArray, isBoolean, isFinite, isString } from "@lindorm/is";
import { CorsError } from "../errors";
import { CorsContext, CorsOptions } from "../types";

export const handleAllowedCredentials = (
  ctx: CorsContext,
  options: CorsOptions,
): void => {
  if (!isBoolean(options.allowCredentials)) return;

  ctx.set("Access-Control-Allow-Credentials", options.allowCredentials.toString());

  if (options.allowOrigins === "*") {
    throw new Error("Cannot set allowCredentials to true when allowOrigins is set to *");
  }
};

export const handleAllowedHeaders = (ctx: CorsContext, options: CorsOptions): void => {
  if (!options.allowHeaders) return;

  if (options.allowHeaders === "*") {
    return ctx.set("Access-Control-Allow-Headers", "*");
  }

  const config = isArray(options.allowHeaders)
    ? options.allowHeaders.map((h) => h.toLowerCase())
    : [];

  if (ctx.preflight) {
    const request =
      ctx.get("Access-Control-Request-Headers")?.toLowerCase()?.split(",") || [];

    if (request.length && request.every((h) => config.includes(h))) {
      return ctx.set("Access-Control-Allow-Headers", request.join(","));
    }

    if (!request.length) {
      return ctx.set("Access-Control-Allow-Headers", config.join(","));
    }

    throw new CorsError("Invalid headers", {
      status: CorsError.Status.Forbidden,
    });
  }

  if (config.length) {
    return ctx.set("Access-Control-Allow-Headers", config.join(","));
  }
};

export const handleAllowedMethods = (ctx: CorsContext, options: CorsOptions): void => {
  if (!options.allowMethods) return;

  if (options.allowMethods === "*") {
    return ctx.set("Access-Control-Allow-Methods", "*");
  }

  const config = isArray(options.allowMethods)
    ? options.allowMethods.map((m) => m.toUpperCase())
    : [];

  if (ctx.preflight) {
    const request = ctx.get("Access-Control-Request-Method")?.toUpperCase() || null;

    if (request && config.includes(request)) {
      return ctx.set("Access-Control-Allow-Methods", request);
    }

    if (!request) {
      return ctx.set("Access-Control-Allow-Methods", config.join(","));
    }

    throw new CorsError("Invalid method", {
      status: CorsError.Status.Forbidden,
    });
  }

  if (config.length) {
    return ctx.set("Access-Control-Allow-Methods", config.join(","));
  }
};

export const handleAllowedOrigin = (ctx: CorsContext, options: CorsOptions): void => {
  if (!options.allowOrigins) return;

  if (options.allowOrigins === "*" && !options.allowCredentials) {
    return ctx.set("Access-Control-Allow-Origin", "*");
  }

  const config = isArray(options.allowOrigins)
    ? options.allowOrigins.map((o) => o.toLowerCase())
    : [];

  const request =
    ctx.get("Origin")?.toLowerCase() || ctx.get("X-Origin")?.toLowerCase() || null;

  if (ctx.preflight) {
    if (request && config.includes(request)) {
      return ctx.set("Access-Control-Allow-Origin", request);
    }

    throw new CorsError("Invalid origin", {
      status: CorsError.Status.Forbidden,
    });
  }

  if (request && config.includes(request)) {
    return ctx.set("Access-Control-Allow-Origin", request);
  }
};

export const handleEmbedderPolicy = (ctx: CorsContext, options: CorsOptions): void => {
  if (!options.embedderPolicy) return;

  ctx.set("Cross-Origin-Embedder-Policy", options.embedderPolicy);
};

export const handleExposeHeaders = (ctx: CorsContext, options: CorsOptions): void => {
  if (!options.exposeHeaders) return;

  const config = isArray(options.exposeHeaders)
    ? options.exposeHeaders.map((h) => h.toLowerCase())
    : [];

  if (config.length) {
    return ctx.set("Access-Control-Expose-Headers", config.join(","));
  }
};

export const handleMaxAge = (ctx: CorsContext, options: CorsOptions): void => {
  if (!isString(options.maxAge) && !isFinite(options.maxAge)) return;
  if (!ctx.preflight) return;

  ctx.set(
    "Access-Control-Max-Age",
    isString(options.maxAge) ? sec(options.maxAge).toString() : options.maxAge.toString(),
  );
};

export const handleOpenerPolicy = (ctx: CorsContext, options: CorsOptions): void => {
  if (!options.openerPolicy) return;

  ctx.set("Cross-Origin-Opener-Policy", options.openerPolicy);
};

export const handlePrivateNetworkAccess = (
  ctx: CorsContext,
  options: CorsOptions,
): void => {
  if (!isBoolean(options.privateNetworkAccess)) return;
  if (!ctx.preflight) return;

  if (ctx.get("Access-Control-Request-Private-Network") !== "true") return;

  ctx.set("Access-Control-Allow-Private-Network", "true");
};
