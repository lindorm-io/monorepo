import { ConnectionBase } from "@lindorm-io/core-connection";
import { Sequelize, Options as SequelizeOptions } from "sequelize";
import { IPostgresConnection, PostgresConnectionOptions } from "../types";

export class PostgresConnection
  extends ConnectionBase<Sequelize, SequelizeOptions>
  implements IPostgresConnection
{
  private readonly custom: typeof Sequelize;

  public constructor(options: PostgresConnectionOptions) {
    const { connectInterval, connectTimeout, logger, custom, ...connectOptions } = options;

    super({
      connectInterval,
      connectTimeout,
      connectOptions: {
        dialect: "postgres",
        logging: false,
        pool: {
          max: 5,
          min: 1,
          ...connectOptions.pool,
        },
        ...connectOptions,
      },
      logger,
    });

    this.custom = custom;
  }

  // abstract implementation

  protected async createClientConnection(): Promise<Sequelize> {
    if (this.custom) {
      return new this.custom(this.connectOptions);
    }
    return new Sequelize(this.connectOptions);
  }

  protected async connectCallback(): Promise<void> {
    await this.client.authenticate();
    await this.client.validate();

    const version = await this.client.databaseVersion();

    this.logger.debug("Database Version", { version });
  }

  protected async disconnectCallback(): Promise<void> {
    await this.client.close();
  }
}
