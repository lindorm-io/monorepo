import type { Dict } from "@lindorm/types";
import type { IEntity } from "../interfaces/index.js";

/**
 * Result of offset/page-based pagination.
 *
 * Provides a page of entities along with rich metadata including total count,
 * page numbers, and a hasMore flag for simple page-based traversal.
 */
export type FindPaginatedResult<E extends IEntity = IEntity> = {
  /** The page of entities. */
  data: Array<E>;
  /** Total number of entities matching the criteria (unpaginated). */
  total: number;
  /** The current page number (1-indexed). */
  page: number;
  /** The number of entities per page. */
  pageSize: number;
  /** Total number of pages. */
  totalPages: number;
  /** Whether a next page exists (i.e. `page * pageSize < total`). */
  hasMore: boolean;
};

/**
 * Options for keyset cursor pagination.
 *
 * Exactly one of `first` or `last` must be provided to specify the page size
 * and direction. Use `after` with `first` for forward pagination, or `before`
 * with `last` for backward pagination.
 *
 * `orderBy` is required — keyset pagination is undefined without a deterministic
 * sort order. The ORM automatically appends primary key column(s) as a tiebreaker
 * if they are not already included in `orderBy`.
 */
export type PaginateOptions<E extends IEntity = IEntity> = {
  /** Forward pagination: return the first N entities after the cursor. */
  first?: number;
  /** Opaque cursor: seek forward past this position. Use with `first`. */
  after?: string;
  /** Backward pagination: return the last N entities before the cursor. */
  last?: number;
  /** Opaque cursor: seek backward before this position. Use with `last`. */
  before?: string;
  /** Required sort order. PK columns are auto-appended as tiebreaker if missing. */
  orderBy: Partial<Record<keyof E, "ASC" | "DESC">>;
  /** Include soft-deleted entities in the results. */
  withDeleted?: boolean;
  /** Bypass the automatic scope filter for this query. */
  withoutScope?: boolean;
  /** Eagerly load these relations alongside the query results. */
  relations?: Array<keyof E>;
  /**
   * Per-query filter overrides.
   *
   * - `true` — enable the filter using pre-registered params from the source
   * - `false` — disable the filter for this query (even if it is default-on)
   * - `Dict<unknown>` — enable the filter with these params (overrides source-registered params)
   */
  filters?: Record<string, boolean | Dict<unknown>>;
  /**
   * When `false`, hydrated entities are not stored in the change-tracker snapshot.
   * Subsequent `update(entity)` on these entities still works, but writes every column
   * and bumps version unconditionally instead of issuing a minimal column-diff UPDATE.
   * Use for read-only paths (serialise + discard).
   */
  snapshot?: boolean;
};

/**
 * Result of keyset cursor pagination.
 *
 * Cursors are opaque base64url-encoded tokens. They encode the sort column values
 * of the boundary rows, enabling efficient seek-based pagination without OFFSET.
 */
export type PaginateResult<E extends IEntity = IEntity> = {
  /** The page of entities. */
  data: Array<E>;
  /** Cursor pointing to the first entity in `data`, or `null` if empty. */
  startCursor: string | null;
  /** Cursor pointing to the last entity in `data`, or `null` if empty. */
  endCursor: string | null;
  /** Whether more entities exist after `endCursor` (forward direction). */
  hasNextPage: boolean;
  /** Whether more entities exist before `startCursor` (backward direction). */
  hasPreviousPage: boolean;
};
