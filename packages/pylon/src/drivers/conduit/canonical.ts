import type { ConduitCacheKey } from "@lindorm/conduit";
import { createHash } from "node:crypto";

/** Recursively sort object keys so the cache identity is order-independent. */
export const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;

    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonical(obj[key]);
        return acc;
      }, {});
  }

  return value ?? null;
};

/**
 * Deterministic sha256 hex identity for a request. Both node-only conduit cache
 * drivers (file + proteus) derive their storage key from this, so an entry
 * written by one is addressable by the same request through the other.
 */
export const cacheId = (key: ConduitCacheKey): string =>
  createHash("sha256")
    .update(
      `${key.method} ${key.url} ${JSON.stringify(canonical(key.query))} ${JSON.stringify(
        canonical(key.body),
      )}`,
    )
    .digest("hex");
