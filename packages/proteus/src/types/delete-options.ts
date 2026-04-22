/**
 * Configure delete query behavior.
 */
export type DeleteOptions = {
  /** Maximum number of rows to delete. Omit to delete all matching rows. */
  limit?: number;
  /**
   * Per-query AbortSignal. Combined with any session-scoped signal at
   * execution time. When aborted, in-flight queries are cancelled
   * server-side (Postgres only — non-pg drivers ignore this field in v1).
   */
  signal?: AbortSignal;
};
