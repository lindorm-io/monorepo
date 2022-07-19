import { ConnectionBase, ConnectionStatus } from "@lindorm-io/core-connection";
import { IRedisConnection, RedisConnectionOptions } from "../types";
import IORedis, { Redis, RedisOptions } from "ioredis";

export class RedisConnection
  extends ConnectionBase<Redis, RedisOptions>
  implements IRedisConnection
{
  public constructor(options: RedisConnectionOptions) {
    const { connectInterval, connectTimeout, logger, ...connectOptions } = options;

    super({ connectInterval, connectTimeout, connectOptions, logger });

    this.clientConnection = new IORedis(this.connectOptions);
  }

  // abstract implementation

  protected async createClientConnection(): Promise<Redis> {
    return this.clientConnection;
  }

  protected async connectCallback(): Promise<void> {
    this.client.on("connect", () => this.setStatus(ConnectionStatus.CONNECTED));
    this.client.on("error", (err: Error) => this.onError(err));
    this.client.on("reconnecting", () => this.setStatus(ConnectionStatus.CONNECTING));

    await this.waitForConnection();
  }

  protected async disconnectCallback(): Promise<void> {
    await this.client.quit();
  }
}
