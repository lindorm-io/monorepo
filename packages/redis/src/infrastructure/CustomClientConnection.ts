import { IRedisConnection, RedisConnectionOptions } from "../types";
import { Redis } from "ioredis";
import { RedisConnectionBase } from "./RedisConnectionBase";

export class CustomClientConnection extends RedisConnectionBase implements IRedisConnection {
  public constructor(options: RedisConnectionOptions) {
    super(options);

    this.redis = options.customClient as Redis;
    this.connected = true;
  }
}
