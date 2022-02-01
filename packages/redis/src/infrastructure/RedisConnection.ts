import { CustomClientConnection } from "./CustomClientConnection";
import { IORedisConnection } from "./IORedisConnection";
import { IRedisConnection, RedisConnectionOptions } from "../types";
import { Redis } from "ioredis";
import { RedisConnectionBase } from "./RedisConnectionBase";

export class RedisConnection implements IRedisConnection {
  private readonly connection: RedisConnectionBase;

  public constructor(options: RedisConnectionOptions) {
    if (options.customClient) {
      this.connection = new CustomClientConnection(options);
    } else {
      this.connection = new IORedisConnection(options);
    }
  }

  public client(): Redis {
    return this.connection.client();
  }

  public async connect(): Promise<void> {
    return this.connection.connect();
  }

  public async quit(): Promise<void> {
    return this.connection.quit();
  }

  public async waitForConnection(): Promise<void> {
    return this.connection.waitForConnection();
  }
}
