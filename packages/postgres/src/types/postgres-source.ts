import { ILogger } from "@lindorm/logger";
import { PoolConfig } from "pg";

export type ClonePostgresSourceOptions = {
  logger?: ILogger;
};

export type PostgresSourceOptions = {
  config?: PoolConfig;
  logger: ILogger;
  url: string;
};
