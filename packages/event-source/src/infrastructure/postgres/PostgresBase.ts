import { IPostgresConnection } from "@lindorm-io/postgres";
import { ILogger } from "@lindorm-io/winston";

export abstract class PostgresBase {
  protected readonly connection: IPostgresConnection;
  protected readonly logger: ILogger;

  protected constructor(connection: IPostgresConnection, logger: ILogger) {
    this.connection = connection;
    this.logger = logger.createChildLogger(["PostgresBase", this.constructor.name]);
  }

  // public

  public async initialise(): Promise<void> {
    await this.connection.connect();
  }
}
