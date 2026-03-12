import { ms } from "@lindorm/date";
import type { MetaCache } from "#internal/entity/types/metadata";
import type { FindCacheOption } from "../../../types/find-options";

export type ResolveCacheTtlInput = {
  findCacheOption?: FindCacheOption;
  metaCache: MetaCache | null;
  sourceTtlMs: number | undefined;
};

export type CacheTtlResult = { enabled: false } | { enabled: true; ttlMs: number };

export const resolveCacheTtl = (input: ResolveCacheTtlInput): CacheTtlResult => {
  const { findCacheOption, metaCache, sourceTtlMs } = input;

  // cache: false -> always disabled (absolute override)
  if (findCacheOption === false) return { enabled: false };

  // Priority 1: explicit per-query TTL
  if (typeof findCacheOption === "object" && findCacheOption.ttl != null) {
    return { enabled: true, ttlMs: ms(findCacheOption.ttl) };
  }

  // Priority 2: @Cache(ttl) decorator TTL
  if (metaCache?.ttlMs != null) {
    return { enabled: true, ttlMs: metaCache.ttlMs };
  }

  // Priority 3: source default TTL
  if (sourceTtlMs != null) {
    return { enabled: true, ttlMs: sourceTtlMs };
  }

  // No TTL resolvable -> disabled (no indefinite caching)
  return { enabled: false };
};
