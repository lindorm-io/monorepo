import IORedis, { Redis, RedisOptions } from "ioredis";
import { ConnectionBase, ConnectionStatus } from "@lindorm-io/core-connection";
import { IRedisConnection, RedisConnectionOptions } from "../types";
import { Logger } from "@lindorm-io/winston";

export class RedisConnection
  extends ConnectionBase<Redis, RedisOptions>
  implements IRedisConnection
{
  public constructor(options: RedisConnectionOptions, logger: Logger) {
    const {
      connectInterval,
      connectTimeout,
      custom,
      host = "localhost",
      port = 6379,
      ...connectOptions
    } = options;

    super(
      {
        connectInterval,
        connectTimeout,
        connectOptions: {
          host,
          port,
          ...connectOptions,
        },
      },
      logger,
    );

    if (custom) {
      this.clientConnection = custom;
    } else {
      this.clientConnection = new IORedis(this.connectOptions);
    }

    this.clientConnection.on("connect", this.onConnect.bind(this));
    this.clientConnection.on("error", this.onError.bind(this));
    this.clientConnection.on("reconnecting", this.onReconnecting.bind(this));
  }

  // abstract implementation

  protected async createClientConnection(): Promise<Redis> {
    return this.clientConnection;
  }

  protected async connectCallback(): Promise<void> {
    await this.waitForConnection();
  }

  protected async disconnectCallback(): Promise<void> {
    await this.client.quit();
  }

  // private event handlers

  private onConnect(): void {
    this.setStatus(ConnectionStatus.CONNECTED);
  }

  private onReconnecting(): void {
    this.setStatus(ConnectionStatus.CONNECTING);
  }
}
