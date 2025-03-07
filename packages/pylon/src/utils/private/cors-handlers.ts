import { HttpMethod } from "@lindorm/conduit";
import { sec } from "@lindorm/date";
import { isArray, isBoolean, isFinite, isString } from "@lindorm/is";
import { CorsError } from "../../errors";
import { CorsOptions, PylonHttpContext } from "../../types";

export const handleAccessControlOrigin = (
  ctx: PylonHttpContext,
  options: CorsOptions,
): boolean => {
  if (!options.allowOrigins) return false;

  if (options.allowOrigins === "*") {
    ctx.set("access-control-allow-origin", "*");

    return true;
  }

  const config = isArray(options.allowOrigins) ? options.allowOrigins : [];

  const origin =
    ctx.get("origin")?.toLowerCase() || ctx.get("x-origin")?.toLowerCase() || null;

  const request = origin?.endsWith("/") ? origin.slice(0, -1) : origin;

  if (request && config.includes(request)) {
    ctx.set("access-control-allow-origin", request);

    return true;
  }

  throw new CorsError("Invalid origin", {
    status: CorsError.Status.Forbidden,
  });
};

export const handleAccessControlCredentials = (
  ctx: PylonHttpContext,
  options: CorsOptions,
): void => {
  if (!isBoolean(options.allowCredentials)) return;

  ctx.set("access-control-allow-credentials", options.allowCredentials.toString());
};

export const handleAccessControlHeaders = (
  ctx: PylonHttpContext,
  options: CorsOptions,
): void => {
  if (!options.allowHeaders) return;

  if (options.allowHeaders === "*") {
    return ctx.set("access-control-allow-headers", "*");
  }

  const config = isArray(options.allowHeaders) ? options.allowHeaders : [];

  const request =
    ctx.get("access-control-request-headers")?.toLowerCase()?.split(",") || [];

  if (request.length && request.every((h) => config.includes(h))) {
    return ctx.set("access-control-allow-headers", request.join(","));
  }

  if (!request.length) {
    return ctx.set("access-control-allow-headers", config.join(","));
  }

  throw new CorsError("Invalid headers", {
    status: CorsError.Status.Forbidden,
  });
};

export const handleAccessControlMethods = (
  ctx: PylonHttpContext,
  options: CorsOptions,
): void => {
  if (!options.allowMethods) return;

  if (options.allowMethods === "*") {
    return ctx.set("access-control-allow-methods", "*");
  }

  const config = isArray(options.allowMethods) ? options.allowMethods : [];

  const request = ctx.get("access-control-request-method")?.toUpperCase() || null;

  if (request && config.includes(request as HttpMethod)) {
    return ctx.set("access-control-allow-methods", request);
  }

  if (!request) {
    return ctx.set("access-control-allow-methods", config.join(","));
  }

  throw new CorsError("Invalid method", {
    status: CorsError.Status.Forbidden,
  });
};

export const handleAccessControlExposeHeaders = (
  ctx: PylonHttpContext,
  options: CorsOptions,
): void => {
  if (!options.exposeHeaders) return;

  const config = isArray(options.exposeHeaders) ? options.exposeHeaders : [];

  if (config.length) {
    return ctx.set("access-control-expose-headers", config.join(","));
  }
};

export const handleAccessControlMaxAge = (
  ctx: PylonHttpContext,
  options: CorsOptions,
): void => {
  if (!isString(options.maxAge) && !isFinite(options.maxAge)) return;

  ctx.set(
    "access-control-max-age",
    isString(options.maxAge) ? sec(options.maxAge).toString() : options.maxAge.toString(),
  );
};

export const handleAccessControlPrivateNetwork = (
  ctx: PylonHttpContext,
  options: CorsOptions,
): void => {
  if (!isBoolean(options.privateNetworkAccess)) return;

  if (ctx.get("access-control-request-private-network") !== "true") return;

  ctx.set("access-control-allow-private-network", "true");
};

export const handleCrossOriginEmbedderPolicy = (
  ctx: PylonHttpContext,
  options: CorsOptions,
): void => {
  if (!options.embedderPolicy) return;

  ctx.set("cross-origin-embedder-policy", options.embedderPolicy);
};

export const handleCrossOriginOpenerPolicy = (
  ctx: PylonHttpContext,
  options: CorsOptions,
): void => {
  if (!options.openerPolicy) return;

  ctx.set("cross-origin-opener-policy", options.openerPolicy);
};
