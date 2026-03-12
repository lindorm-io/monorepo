export type PostgresQueryResult<R = Record<string, unknown>> = {
  rows: Array<R>;
  rowCount: number;
};

export type PostgresQueryClient = {
  query: <R = Record<string, unknown>>(
    sql: string,
    params?: Array<unknown>,
  ) => Promise<PostgresQueryResult<R>>;
};
