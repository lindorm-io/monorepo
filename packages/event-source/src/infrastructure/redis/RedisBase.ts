import { ILogger } from "@lindorm-io/winston";
import { IRedisConnection } from "@lindorm-io/redis";
import { RedisBaseOptions } from "../../types";

export abstract class RedisBase {
  protected readonly connection: IRedisConnection;
  protected readonly logger: ILogger;
  protected promise: () => Promise<void>;

  protected constructor(options: RedisBaseOptions, logger: ILogger) {
    this.connection = options.connection;
    this.logger = logger.createChildLogger(["RedisBase", this.constructor.name]);

    this.promise = this.initialise;
  }

  // private

  private async initialise(): Promise<void> {
    const start = Date.now();

    await this.connection.connect();

    this.logger.debug("Initialisation successful", {
      time: Date.now() - start,
    });

    this.promise = (): Promise<void> => Promise.resolve();
  }
}
