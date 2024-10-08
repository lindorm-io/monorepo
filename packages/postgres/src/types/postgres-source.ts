import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import { PoolConfig, QueryResult } from "pg";

export type ClonePostgresSourceOptions = {
  logger?: ILogger;
};

export type PostgresSourceOptions = {
  config?: PoolConfig;
  logger: ILogger;
  url: string;
};

export type PostgresQueryOptions = {
  stringifyComplexTypes?: boolean; // default: true
};

export type PostgresResult<T extends Dict> = Omit<QueryResult, "rows"> & {
  rows: Array<T>;
};
