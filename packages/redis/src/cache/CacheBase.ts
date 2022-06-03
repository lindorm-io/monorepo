import { CacheOptions } from "../types";
import { ILogger } from "@lindorm-io/winston";
import { Redis } from "ioredis";
import { RedisConnection } from "../infrastructure";

export abstract class CacheBase {
  protected connection: RedisConnection;
  protected client: Redis;
  protected expiresInSeconds: number | undefined;
  protected logger: ILogger;

  protected constructor(options: CacheOptions) {
    this.connection = options.connection;
    this.client = this.connection.client();
    this.expiresInSeconds = options.expiresInSeconds || undefined;
    this.logger = options.logger.createChildLogger(["CacheBase", this.constructor.name]);
  }
}
