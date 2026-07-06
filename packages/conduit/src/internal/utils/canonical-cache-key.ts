import { isObjectLike } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { sortKeys } from "@lindorm/utils";
import type { ConduitCacheKey } from "../../types/index.js";

/**
 * A deterministic, order-independent string identity for a request — used for
 * the single-flight map and by the in-memory driver. Browser-safe (no crypto):
 * `sortKeys` makes object-key order irrelevant, so `?a=1&b=2` and `?b=2&a=1`
 * resolve to the same identity.
 */
export const canonicalCacheKey = (key: ConduitCacheKey): string =>
  JSON.stringify({
    method: key.method.toUpperCase(),
    url: key.url,
    query: isObjectLike(key.query) ? sortKeys(key.query as Dict) : (key.query ?? null),
    body: isObjectLike(key.body) ? sortKeys(key.body as Dict) : (key.body ?? null),
  });
