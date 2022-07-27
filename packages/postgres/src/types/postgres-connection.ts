import { Sequelize, Options as SequelizeOptions } from "sequelize";
import { ConnectionBaseOptions, IConnectionBase } from "@lindorm-io/core-connection";

export interface ExtendedPostgresOptions extends SequelizeOptions {
  custom?: typeof Sequelize;
  database: string;
  host: string;
  port: number;
  username: string;
  password: string;
}

export type PostgresConnectionOptions = ConnectionBaseOptions<SequelizeOptions> &
  ExtendedPostgresOptions;

export type IPostgresConnection = IConnectionBase<Sequelize>;
