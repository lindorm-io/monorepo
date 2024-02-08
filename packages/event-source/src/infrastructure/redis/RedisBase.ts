import { Logger } from "@lindorm-io/core-logger";
import { IRedisConnection } from "@lindorm-io/redis";

export abstract class RedisBase {
  protected readonly connection: IRedisConnection;
  protected readonly logger: Logger;
  protected promise: () => Promise<void>;

  protected constructor(connection: IRedisConnection, logger: Logger) {
    this.connection = connection;
    this.logger = logger.createChildLogger(["RedisBase", this.constructor.name]);

    this.promise = this.connect;
  }

  // protected

  protected async connect(): Promise<void> {
    await this.connection.connect();
  }
}
