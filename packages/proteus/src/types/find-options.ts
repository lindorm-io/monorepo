import type { ReadableTime } from "@lindorm/date";
import type { Dict } from "@lindorm/types";
import type { IEntity } from "../interfaces/index.js";

/**
 * Controls per-query caching behavior.
 * - `false` -- disable caching for this query (absolute override)
 * - `true` -- enable caching using @Cache decorator TTL or source default TTL.
 *   If no TTL is configured anywhere, caching is silently disabled (no indefinite caching).
 * - `{ ttl: ReadableTime }` -- enable with explicit TTL, overriding decorator/source defaults
 */
export type FindCacheOption = boolean | { ttl?: ReadableTime };

/**
 * Control row-level locking behavior for SQL queries.
 *
 * - `"pessimistic_read"` -- acquire a shared lock (SELECT ... FOR SHARE)
 * - `"pessimistic_write"` -- acquire an exclusive lock (SELECT ... FOR UPDATE)
 * - `"pessimistic_read_skip"` -- FOR SHARE SKIP LOCKED (skip already-locked rows)
 * - `"pessimistic_read_fail"` -- FOR SHARE NOWAIT (fail immediately if rows locked)
 * - `"pessimistic_write_skip"` -- FOR UPDATE SKIP LOCKED (skip already-locked rows)
 * - `"pessimistic_write_fail"` -- FOR UPDATE NOWAIT (fail immediately if rows locked)
 */
export type LockMode =
  | "pessimistic_read"
  | "pessimistic_write"
  | "pessimistic_read_skip"
  | "pessimistic_read_fail"
  | "pessimistic_write_skip"
  | "pessimistic_write_fail";

/**
 * Shared fields for all find operations (no pagination).
 */
export type FindOptionsBase<E extends IEntity = IEntity> = {
  /** Return only these fields from each entity. */
  select?: Array<keyof E>;
  /** Sort results by one or more fields. */
  order?: Partial<Record<keyof E, "ASC" | "DESC">>;
  /** Return only distinct rows. */
  distinct?: boolean;
  /** Query the entity table as of this point in time (temporal/versioned tables). */
  versionTimestamp?: Date;
  /** Include all versions of versioned entities (bypass version-end-date filter). */
  withAllVersions?: boolean;
  /** Eagerly load these relations alongside the query results. */
  relations?: Array<keyof E>;
  /** Include soft-deleted entities in the results. */
  withDeleted?: boolean;
  /** Bypass the automatic scope filter for this query. */
  withoutScope?: boolean;
  /** Acquire a row-level lock on returned entities (SQL drivers only). */
  lock?: LockMode;
  /** Override caching behavior for this query. */
  cache?: FindCacheOption;
  /**
   * Per-query filter overrides.
   *
   * - `true` -- enable the filter using pre-registered params from the source
   * - `false` -- disable the filter for this query (even if it is default-on)
   * - `Dict<unknown>` -- enable the filter with these params (overrides source-registered params)
   */
  filters?: Record<string, boolean | Dict<unknown>>;
  /**
   * Per-query AbortSignal. Combined with any session-scoped signal at
   * execution time. When aborted, in-flight queries are cancelled
   * server-side (Postgres only — non-pg drivers ignore this field in v1).
   */
  signal?: AbortSignal;
};

/**
 * Configure how entities are retrieved by find operations.
 * Uses limit/offset for manual pagination.
 */
export type FindOptions<E extends IEntity = IEntity> = FindOptionsBase<E> & {
  /** Maximum number of entities to return. */
  limit?: number;
  /** Number of entities to skip (use with `limit` for manual pagination). */
  offset?: number;
};

/**
 * Configure how entities are retrieved by findPaginated.
 * Uses page/pageSize for automatic page-based pagination.
 */
export type FindPaginatedOptions<E extends IEntity = IEntity> = FindOptionsBase<E> & {
  /** Page number for automatic pagination (1-indexed). Use with `pageSize`. */
  page?: number;
  /** Number of entities per page when using `page`. */
  pageSize?: number;
};
