import type { IEntity } from "../interfaces/Entity.js";

/**
 * Configure upsert (INSERT ... ON CONFLICT) behavior.
 */
export type UpsertOptions<E extends IEntity> = {
  /** Fields that define the uniqueness constraint for conflict detection. Defaults to the primary key. */
  conflictOn?: Array<keyof E>;
  /**
   * Per-query AbortSignal. Combined with any session-scoped signal at
   * execution time. When aborted, in-flight queries are cancelled
   * server-side (Postgres only — non-pg drivers ignore this field in v1).
   */
  signal?: AbortSignal;
};
