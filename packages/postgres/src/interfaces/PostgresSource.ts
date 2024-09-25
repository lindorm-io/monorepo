import { Pool, QueryConfig, QueryConfigValues, QueryResult, QueryResultRow } from "pg";
import { ClonePostgresSourceOptions } from "../types";

export interface IPostgresSource {
  client: Pool;

  clone(options?: ClonePostgresSourceOptions): IPostgresSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setup(): Promise<void>;

  query<R extends QueryResultRow = any, V = Array<any>>(
    queryTextOrConfig: string | QueryConfig<V>,
    values?: QueryConfigValues<V>,
  ): Promise<QueryResult<R>>;
}
