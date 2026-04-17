import { ms } from "@lindorm/date";
import type { ReadableTime } from "@lindorm/date";
import { stageCache } from "../internal/entity/metadata/stage-metadata";

/**
 * Enable query-level caching for this entity.
 *
 * - `@Cache()` — enable caching using the source-level default TTL
 * - `@Cache("5m")` — enable caching with a specific TTL for this entity
 *
 * Requires a cache adapter to be configured on the ProteusSource.
 * Per-query caching can be overridden via `FindOptions.cache`.
 */
export const Cache =
  (ttl?: ReadableTime) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    const ttlMs = ttl != null ? ms(ttl) : null;
    stageCache(context.metadata, { ttlMs });
  };
