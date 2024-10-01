import { Dict } from "@lindorm/types";
import { Pool, QueryConfig, QueryConfigValues } from "pg";
import { ClonePostgresSourceOptions, PostgresResult } from "../types";
import { IPostgresQueryBuilder } from "./PostgresQueryBuilder";

export interface IPostgresSource {
  client: Pool;

  clone(options?: ClonePostgresSourceOptions): IPostgresSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setup(): Promise<void>;

  query<R extends Dict = any, V = Array<any>>(
    queryTextOrConfig: string | QueryConfig<V>,
    values?: QueryConfigValues<V>,
  ): Promise<PostgresResult<R>>;
  queryBuilder<T extends Dict>(table: string): IPostgresQueryBuilder<T>;
}
