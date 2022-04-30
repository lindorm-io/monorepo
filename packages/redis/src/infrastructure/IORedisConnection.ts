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
      this.logger.verbose("connected to redis", this.clientOptions);
      this.connected = true;
    });

    this.redis.on("error", (err: Error) => {
      this.logger.error("redis encountered an error", { error: err });
      this.connected = false;
    });

    this.redis.on("reconnecting", (delay: number) => {
      this.logger.verbose("reconnecting to redis", { delay });
      this.connected = false;
    });
  }
}
