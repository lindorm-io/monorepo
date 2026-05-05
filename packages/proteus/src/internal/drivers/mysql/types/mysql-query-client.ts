export type MysqlQueryResult<R = Record<string, unknown>> = {
  rows: Array<R>;
  rowCount: number;
  insertId: number;
};

/**
 * Typed wrapper around a mysql2/promise Pool or PoolConnection.
 * Normalizes the `[rows, fields]` tuple return into a `MysqlQueryResult`.
 */
export type MysqlQueryClient = {
  query: <R = Record<string, unknown>>(
    sql: string,
    params?: Array<unknown>,
  ) => Promise<MysqlQueryResult<R>>;
  /**
   * True when the underlying transport multiplexes queries across connections
   * (pool-backed). False / undefined when the client wraps a single
   * connection (transactional, sync session). See packages/proteus/src/internal/utils/parallel.ts.
   */
  readonly multiplexed?: boolean;
};
