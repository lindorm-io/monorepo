import { HttpMethod } from "@lindorm/conduit";
import { sec } from "@lindorm/date";
import { isArray, isBoolean, isFinite, isString } from "@lindorm/is";
import { CorsError } from "../../errors";
import { CorsContext, CorsOptions } from "../../types";

export const handleAccessControlOrigin = (
  ctx: CorsContext,
  options: CorsOptions,
): boolean => {
  if (!options.allowOrigins) return false;

  if (options.allowOrigins === "*") {
    ctx.set("Access-Control-Allow-Origin", "*");
    return true;
  }

  const config = isArray(options.allowOrigins) ? options.allowOrigins : [];

  const origin =
    ctx.get("Origin")?.toLowerCase() || ctx.get("X-Origin")?.toLowerCase() || null;

  const request = origin?.endsWith("/") ? origin.slice(0, -1) : origin;

  if (ctx.preflight) {
    if (request && config.includes(request)) {
      ctx.set("Access-Control-Allow-Origin", request);
      return true;
    }

    throw new CorsError("Invalid origin", {
      status: CorsError.Status.Forbidden,
    });
  }

  if (request && config.includes(request)) {
    ctx.set("Access-Control-Allow-Origin", request);
    return true;
  }

  return false;
};

export const handleAccessControlCredentials = (
  ctx: CorsContext,
  options: CorsOptions,
): void => {
  if (!isBoolean(options.allowCredentials)) return;

  ctx.set("Access-Control-Allow-Credentials", options.allowCredentials.toString());
};

export const handleAccessControlHeaders = (
  ctx: CorsContext,
  options: CorsOptions,
): void => {
  if (!options.allowHeaders) return;

  if (options.allowHeaders === "*") {
    return ctx.set("Access-Control-Allow-Headers", "*");
  }

  const config = isArray(options.allowHeaders) ? options.allowHeaders : [];

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

export const handleAccessControlMethods = (
  ctx: CorsContext,
  options: CorsOptions,
): void => {
  if (!options.allowMethods) return;

  if (options.allowMethods === "*") {
    return ctx.set("Access-Control-Allow-Methods", "*");
  }

  const config = isArray(options.allowMethods) ? options.allowMethods : [];

  if (ctx.preflight) {
    const request = ctx.get("Access-Control-Request-Method")?.toUpperCase() || null;

    if (request && config.includes(request as HttpMethod)) {
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

export const handleAccessControlExposeHeaders = (
  ctx: CorsContext,
  options: CorsOptions,
): void => {
  if (!options.exposeHeaders) return;

  const config = isArray(options.exposeHeaders) ? options.exposeHeaders : [];

  if (config.length) {
    return ctx.set("Access-Control-Expose-Headers", config.join(","));
  }
};

export const handleAccessControlMaxAge = (
  ctx: CorsContext,
  options: CorsOptions,
): void => {
  if (!isString(options.maxAge) && !isFinite(options.maxAge)) return;
  if (!ctx.preflight) return;

  ctx.set(
    "Access-Control-Max-Age",
    isString(options.maxAge) ? sec(options.maxAge).toString() : options.maxAge.toString(),
  );
};

export const handleAccessControlPrivateNetwork = (
  ctx: CorsContext,
  options: CorsOptions,
): void => {
  if (!isBoolean(options.privateNetworkAccess)) return;
  if (!ctx.preflight) return;

  if (ctx.get("Access-Control-Request-Private-Network") !== "true") return;

  ctx.set("Access-Control-Allow-Private-Network", "true");
};

export const handleCrossOriginEmbedderPolicy = (
  ctx: CorsContext,
  options: CorsOptions,
): void => {
  if (!options.embedderPolicy) return;

  ctx.set("Cross-Origin-Embedder-Policy", options.embedderPolicy);
};

export const handleCrossOriginOpenerPolicy = (
  ctx: CorsContext,
  options: CorsOptions,
): void => {
  if (!options.openerPolicy) return;

  ctx.set("Cross-Origin-Opener-Policy", options.openerPolicy);
};
