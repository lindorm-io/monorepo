import { ConnectionBaseOptions, IConnectionBase } from "@lindorm-io/core-connection";
import { DataSource } from "typeorm";
import { PostgresConnectionOptions as DataSourceOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { ObjectLiteral } from "typeorm/common/ObjectLiteral";
import { EntityTarget } from "typeorm/common/EntityTarget";
import { Repository } from "typeorm/repository/Repository";
import { EntityManager } from "typeorm/entity-manager/EntityManager";

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

export interface IPostgresConnection extends IConnectionBase<DataSource> {
  getRepository<Entity extends ObjectLiteral>(target: EntityTarget<Entity>): Repository<Entity>;
  transaction<T = void>(runInTransaction: (entityManager: EntityManager) => Promise<T>): Promise<T>;
}
