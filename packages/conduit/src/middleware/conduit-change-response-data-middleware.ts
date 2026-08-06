import { type ChangeCase, changeKeys, type KeysOptions } from "@lindorm/case";
import { isArray, isObject } from "@lindorm/is";
import type { ConduitMiddleware } from "../types/index.js";

/**
 * `options.depth` bounds how far into the response the conversion reaches — the
 * inbound mirror of the request-body case. An `authorization_details` array on a
 * token or introspection response carries type-specific fields that RFC 9396 §2
 * defines elsewhere, and camelising them rewrites someone else's schema.
 *
 * Left unbounded by default: a response often nests legitimately (OIDC
 * `address`, for instance), so only a caller that knows its payload can pin it.
 */
export const conduitChangeResponseDataMiddleware = (
  mode: ChangeCase = "camel",
  options?: KeysOptions,
): ConduitMiddleware =>
  async function conduitChangeResponseDataMiddleware(ctx, next) {
    await next();

    const { data } = ctx.res;

    if (isObject(data) || isArray(data)) {
      ctx.res.data = changeKeys(data, mode, options);
    }
  };
