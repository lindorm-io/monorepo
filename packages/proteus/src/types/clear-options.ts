/**
 * Configure TRUNCATE behavior for `repository.clear()`.
 */
export type ClearOptions = {
  /** Cascade the truncation to dependent tables via foreign key constraints. */
  cascade?: boolean;
  /** Reset auto-increment / identity sequences to their initial values. */
  restartIdentity?: boolean;
  /**
   * Per-query AbortSignal. Combined with any session-scoped signal at
   * execution time. When aborted, in-flight queries are cancelled
   * server-side (Postgres only — non-pg drivers ignore this field in v1).
   */
  signal?: AbortSignal;
};
