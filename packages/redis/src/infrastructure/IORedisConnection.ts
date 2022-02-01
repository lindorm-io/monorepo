import IORedis from "ioredis";
import { IRedisConnection, RedisConnectionOptions } from "../types";
import { RedisConnectionBase } from "./RedisConnectionBase";

export class IORedisConnection extends RedisConnectionBase implements IRedisConnection {
  public constructor(options: RedisConnectionOptions) {
    super(options);

    this.connected = false;
  }

  public async connect(): Promise<void> {
    if (this.connected) return;

    this.redis = new IORedis(this.clientOptions);

    this.redis.on("connect", () => {
      this.logger.info("Connected to Redis", this.clientOptions);
      this.connected = true;
    });

    this.redis.on("error", (err: Error) => {
      this.logger.error("Redis encountered an error", { error: err });
      this.connected = false;
    });

    this.redis.on("reconnecting", (delay: number) => {
      this.logger.info("Reconnecting to Redis", { delay });
      this.connected = false;
    });
  }
}
