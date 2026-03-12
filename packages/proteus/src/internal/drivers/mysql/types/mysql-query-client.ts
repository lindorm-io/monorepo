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
};
