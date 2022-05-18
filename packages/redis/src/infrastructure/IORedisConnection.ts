import IORedis from "ioredis";
import { IRedisConnection, RedisConnectionOptions } from "../types";
import { RedisConnectionBase } from "./RedisConnectionBase";

export class IORedisConnection extends RedisConnectionBase implements IRedisConnection {
  public constructor(options: RedisConnectionOptions) {
    super(options);

    this.connected = false;
    this.redis = new IORedis(this.clientOptions);

    this.redis.on("connect", () => {
      this.logger.debug("connected to redis", this.clientOptions);
      this.connected = true;
    });

    this.redis.on("error", (err: Error) => {
      this.logger.error("redis encountered an error", { error: err });
      this.connected = false;
    });

    this.redis.on("reconnecting", (delay: number) => {
      this.logger.debug("reconnecting to redis", { delay });
      this.connected = false;
    });
  }
}
