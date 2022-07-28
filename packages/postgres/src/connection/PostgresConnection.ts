import { ConnectionBase } from "@lindorm-io/core-connection";
import { DataSource } from "typeorm";
import { EntityManager } from "typeorm/entity-manager/EntityManager";
import { EntityTarget } from "typeorm/common/EntityTarget";
import { IPostgresConnection, PostgresConnectionOptions } from "../types";
import { Logger } from "@lindorm-io/winston";
import { ObjectLiteral } from "typeorm/common/ObjectLiteral";
import { PostgresConnectionOptions as DataSourceOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { Repository } from "typeorm/repository/Repository";

export class PostgresConnection
  extends ConnectionBase<DataSource, DataSourceOptions>
  implements IPostgresConnection
{
  private readonly custom: typeof DataSource;

  public constructor(options: PostgresConnectionOptions, logger: Logger) {
    const {
      connectInterval,
      connectTimeout,
      custom,
      host = "localhost",
      port = 5432,
      ...connectOptions
    } = options;

    super(
      {
        connectInterval,
        connectTimeout,
        connectOptions: {
          extra: {
            connectionLimit: 5,
            ...(connectOptions.extra || {}),
          },
          host,
          port,
          ...connectOptions,
          type: "postgres",
        },
        type: "postgres",
      },
      logger,
    );

    this.custom = custom;
  }

  // public

  public getRepository<Entity extends ObjectLiteral>(
    target: EntityTarget<Entity>,
  ): Repository<Entity> {
    return this.client.getRepository(target);
  }

  public transaction<T = void>(
    runInTransaction: (entityManager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.client.transaction(runInTransaction);
  }

  // abstract implementation

  protected async createClientConnection(): Promise<DataSource> {
    if (this.custom) {
      return new this.custom(this.connectOptions);
    }
    return new DataSource(this.connectOptions);
  }

  protected async connectCallback(): Promise<void> {
    await this.client.initialize();
  }

  protected async disconnectCallback(): Promise<void> {
    await this.client.close();
  }
}
