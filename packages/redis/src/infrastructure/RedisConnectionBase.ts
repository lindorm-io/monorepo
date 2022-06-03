import { INTERVAL, TIMEOUT } from "../constant";
import { IRedisConnection, RedisConnectionOptions } from "../types";
import { ILogger } from "@lindorm-io/winston";
import { Redis, RedisOptions } from "ioredis";

export abstract class RedisConnectionBase implements IRedisConnection {
  protected readonly clientOptions: RedisOptions;
  protected readonly logger: ILogger;
  protected connected: boolean;
  protected redis: Redis | undefined;

  protected constructor(options: RedisConnectionOptions) {
    const { winston, ...clientOptions } = options;

    this.clientOptions = clientOptions;
    this.connected = false;
    this.logger = winston.createChildLogger(["RedisConnectionBase", this.constructor.name]);
  }

  public client(): Redis {
    if (!this.redis) {
      throw new Error("Redis Client could not be found");
    }

    return this.redis;
  }

  public async quit(): Promise<void> {
    if (!this.redis) {
      throw new Error("Redis Client could not be found");
    }

    await this.redis.quit();
  }

  public async waitForConnection(): Promise<void> {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      let current = 0;

      const interval = setInterval(() => {
        current += INTERVAL;

        if (this.connected) {
          clearInterval(interval);
          resolve();
        }

        if (current >= TIMEOUT) {
          clearInterval(interval);
          reject(new Error("Unable to establish connection"));
        }
      }, INTERVAL);
    });
  }
}
