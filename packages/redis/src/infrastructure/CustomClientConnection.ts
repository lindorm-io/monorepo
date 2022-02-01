import { IRedisConnection, RedisConnectionOptions } from "../types";
import { Redis } from "ioredis";
import { RedisConnectionBase } from "./RedisConnectionBase";

export class CustomClientConnection extends RedisConnectionBase implements IRedisConnection {
  private readonly customClient: Redis;

  public constructor(options: RedisConnectionOptions) {
    super(options);

    this.customClient = options.customClient as Redis;
    this.connected = false;
  }

  public async connect(): Promise<void> {
    if (this.connected) return;

    this.redis = this.customClient;
    this.connected = true;
  }
}
