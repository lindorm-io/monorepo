import { CacheOptions } from "../types";
import { Logger } from "@lindorm-io/winston";
import { Redis } from "ioredis";

export abstract class CacheBase {
  protected client: Redis;
  protected expiresInSeconds: number | undefined;
  protected logger: Logger;

  protected constructor(options: CacheOptions) {
    this.client = options.client;
    this.expiresInSeconds = options.expiresInSeconds || undefined;
    this.logger = options.logger.createChildLogger("CacheBase");
  }
}
