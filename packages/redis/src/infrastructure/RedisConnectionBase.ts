import { Redis, RedisOptions } from "ioredis";
import { IRedisConnection, RedisConnectionOptions } from "../types";
import { Logger } from "@lindorm-io/winston";
import { INTERVAL, TIMEOUT } from "../constant";

export abstract class RedisConnectionBase implements IRedisConnection {
  protected readonly clientOptions: RedisOptions;
  protected readonly logger: Logger;
  protected connected: boolean;
  protected redis: Redis | undefined;

  protected constructor(options: RedisConnectionOptions) {
    const { winston, ...clientOptions } = options;

    this.clientOptions = clientOptions;
    this.connected = false;
    this.logger = winston.createChildLogger("RedisConnection");
  }

  public client(): Redis {
    if (!this.redis) {
      throw new Error("Client could not be found. Call connect() or waitForConnection() first.");
    }

    return this.redis;
  }

  public abstract connect(): Promise<void>;

  public async quit(): Promise<void> {
    if (!this.redis) return;

    await this.redis.quit();
  }

  public async waitForConnection(): Promise<void> {
    if (this.connected) return;

    if (!this.redis) {
      await this.connect();
    }

    const timeout = TIMEOUT;
    let interval: NodeJS.Timer;
    let time = 0;

    return new Promise((resolve, reject) => {
      interval = setInterval(() => {
        if (this.connected) {
          clearInterval(interval);
          resolve();
        }

        if (time >= timeout) {
          clearInterval(interval);
          reject(new Error("Unable to establish connection"));
        }

        time += INTERVAL;
      }, INTERVAL);
    });
  }
}
