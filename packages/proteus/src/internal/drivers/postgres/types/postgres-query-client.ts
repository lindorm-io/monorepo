export type PostgresQueryResult<R = Record<string, unknown>> = {
  rows: Array<R>;
  rowCount: number;
};

export type PostgresQueryClient = {
  query: <R = Record<string, unknown>>(
    sql: string,
    params?: Array<unknown>,
  ) => Promise<PostgresQueryResult<R>>;
  /**
   * True when the underlying transport multiplexes queries across connections
   * (pool-backed). False / undefined when the client wraps a single
   * connection (transactional, sync session). See packages/proteus/src/internal/utils/parallel.ts.
   */
  readonly multiplexed?: boolean;
};
