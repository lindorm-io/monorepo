import { ConnectionBaseOptions, IConnectionBase } from "@lindorm-io/core-connection";
import { DataSource } from "typeorm";
import { PostgresConnectionOptions as DataSourceOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

/*
 * Suppressing type since it's declared in connection
 */
// @ts-ignore
export interface ExtendedDataSourceOptions extends DataSourceOptions {
  custom?: typeof DataSource;
  database: string;
  type?: never;
}

export type PostgresConnectionOptions = ConnectionBaseOptions<DataSourceOptions> &
  ExtendedDataSourceOptions;

export type IPostgresConnection = IConnectionBase<DataSource>;
