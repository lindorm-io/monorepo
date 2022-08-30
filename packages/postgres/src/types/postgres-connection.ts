import { ConnectionBaseOptions, IConnectionBase } from "@lindorm-io/core-connection";
import { PoolConfig, Pool, QueryResultRow, QueryConfig, QueryResult } from "pg";

export interface ExtendedPoolConfig extends PoolConfig {
  custom?: typeof Pool;
  database: string;
}

export type PostgresConnectionOptions = ConnectionBaseOptions<PoolConfig> & ExtendedPoolConfig;

export interface IPostgresConnection extends IConnectionBase<Pool> {
  query<TResult extends QueryResultRow = QueryResultRow, TValues extends Array<any> = Array<any>>(
    queryTextOrConfig: QueryConfig<TValues> | string,
    values?: TValues,
  ): Promise<QueryResult<TResult>>;
}
