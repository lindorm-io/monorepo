import { RedisConnection } from "@lindorm-io/redis";
import { Logger } from "@lindorm-io/winston";
import { CacheStoreOptions } from "../types";

export abstract class RedisBase {
  protected readonly connection: RedisConnection;
  protected readonly logger: Logger;
  protected promise: () => Promise<void>;

  protected constructor(options: CacheStoreOptions) {
    this.connection = options.connection;
    this.logger = options.logger.createChildLogger(["RedisBase", this.constructor.name]);

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
