import { ConnectionBase } from "@lindorm-io/core-connection";
import { IMongoConnection, MongoConnectionOptions } from "../types";
import { MongoClient, MongoClientOptions } from "mongodb";

export class MongoConnection
  extends ConnectionBase<MongoClient, MongoClientOptions>
  implements IMongoConnection
{
  private readonly url: string;

  public readonly database: string;

  public constructor(options: MongoConnectionOptions) {
    const { connectInterval, connectTimeout, logger, database, host, port, ...connectOptions } =
      options;

    super({
      connectInterval,
      connectTimeout,
      connectOptions: { maxPoolSize: 5, minPoolSize: 1, ...connectOptions },
      logger,
    });

    this.database = database;
    this.url = `mongodb://${host}:${port}/`;
  }

  // abstract implementation

  protected async createClientConnection(): Promise<MongoClient> {
    return await MongoClient.connect(this.url, this.connectOptions);
  }

  protected async connectCallback(): Promise<void> {
    this.client.on("error", (err) => this.onError(err));
  }

  protected async disconnectCallback(): Promise<void> {
    await this.client.close();
  }
}
