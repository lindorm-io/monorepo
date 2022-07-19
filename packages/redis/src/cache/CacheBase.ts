import { CacheOptions } from "../types";
import { ILogger } from "@lindorm-io/winston";
import { RedisConnection } from "../infrastructure";

export abstract class CacheBase {
  protected connection: RedisConnection;
  protected logger: ILogger;

  protected constructor(options: CacheOptions) {
    this.connection = options.connection;
    this.logger = options.logger.createChildLogger(["CacheBase", this.constructor.name]);
  }
}
