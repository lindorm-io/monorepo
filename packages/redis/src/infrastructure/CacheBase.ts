import { CacheOptions } from "../types";
import { Logger } from "@lindorm-io/core-logger";
import { RedisConnection } from "../connection";

export abstract class CacheBase {
  protected connection: RedisConnection;
  protected logger: Logger;

  protected constructor(options: CacheOptions) {
    this.connection = options.connection;
    this.logger = options.logger.createChildLogger([
      "CacheBase",
      this.connection.namespace,
      this.constructor.name,
    ]);
  }
}
