import { createHash } from "node:crypto";

/**
 * Build a namespace-scoped MySQL advisory lock name.
 *
 * MySQL lock names are limited to 64 characters. If the resulting name
 * exceeds that limit, the namespace portion is replaced with a truncated
 * SHA-256 hash to stay within bounds.
 */
export const buildMysqlLockName = (prefix: string, namespace: string | null): string => {
  const ns = namespace ?? "default";
  const candidate = `${prefix}_${ns}`;

  if (candidate.length <= 64) {
    return candidate;
  }

  // Hash the namespace to stay under the 64-char limit.
  // Use the first 32 hex chars (16 bytes) — collision risk is negligible.
  const hash = createHash("sha256").update(ns).digest("hex").slice(0, 32);
  return `${prefix}_${hash}`;
};

/**
 * Hash a namespace into a 32-bit signed integer for use as one of the
 * two keys in Postgres `pg_advisory_lock(key1, key2)`.
 *
 * The hash is deterministic and distributes well across the int32 range.
 */
export const hashNamespaceToInt32 = (namespace: string | null): number => {
  const ns = namespace ?? "default";
  const hash = createHash("sha256").update(ns).digest();
  // Read first 4 bytes as signed 32-bit integer (big-endian)
  return hash.readInt32BE(0);
};
