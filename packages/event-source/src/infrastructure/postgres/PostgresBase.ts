import { IPostgresConnection } from "@lindorm-io/postgres";
import { ILogger } from "@lindorm-io/winston";

export abstract class PostgresBase {
  protected readonly connection: IPostgresConnection;
  protected readonly logger: ILogger;

  protected promise: () => Promise<void>;

  protected constructor(connection: IPostgresConnection, logger: ILogger) {
    this.connection = connection;
    this.logger = logger.createChildLogger(["PostgresBase", this.constructor.name]);

    this.promise = this.initialise;
  }

  // private

  private async initialise(): Promise<void> {
    await this.connection.connect();

    this.logger.debug("Initialisation successful");

    this.promise = (): Promise<void> => Promise.resolve();
  }
}
