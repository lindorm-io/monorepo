import { ConnectionBase } from "@lindorm-io/core-connection";
import { Logger } from "@lindorm-io/core-logger";
import { IMongoConnection, MongoConnectionOptions } from "../types";
import {
  Collection,
  CollectionOptions,
  Db,
  DbOptions,
  MongoClient,
  MongoClientOptions,
} from "mongodb";

export class MongoConnection
  extends ConnectionBase<MongoClient, MongoClientOptions>
  implements IMongoConnection
{
  private readonly url: string;
  private readonly custom: typeof MongoClient | undefined;
  private readonly dbName: string | undefined;
  private readonly dbOptions: DbOptions | undefined;
  private db: Db | undefined;

  public constructor(options: MongoConnectionOptions, logger: Logger) {
    const {
      authSource = "admin",
      connectInterval,
      connectTimeout,
      database,
      databaseOptions,
      host = "localhost",
      port = 27017,
      custom,
      ...connectOptions
    } = options;

    super(
      {
        connectInterval,
        connectTimeout,
        connectOptions: {
          keepAlive: true,
          maxPoolSize: 5,
          minPoolSize: 1,
          ...connectOptions,
        },
        type: "mongo",
      },
      logger,
    );

    let url = `mongodb://${host}:${port}`;

    if (database) {
      url = `${url}/${database}?authSource=${authSource}`;
    }

    this.url = url;
    this.custom = custom;
    this.dbName = database;
    this.dbOptions = databaseOptions;
  }

  // public properties

  public get database(): Db {
    if (!this.db) {
      throw new Error("Database has not been initialised");
    }
    return this.db;
  }

  public set database(_: Db) {
    /* ignored */
  }

  // public

  public collection(collection: string, options?: CollectionOptions): Collection {
    return this.database.collection(collection, options);
  }

  // abstract implementation

  protected async createClientConnection(): Promise<MongoClient> {
    this.logger.debug("Connecting to Mongo", { url: this.url, options: this.connectOptions });

    if (this.custom) {
      return await this.custom.connect(this.url, this.connectOptions!);
    }
    return await MongoClient.connect(this.url, this.connectOptions!);
  }

  protected async connectCallback(): Promise<void> {
    this.client.on("error", this.onError.bind(this));

    this.db = this.client.db(this.dbName, this.dbOptions);
  }

  protected async disconnectCallback(): Promise<void> {
    await this.client.close();
  }
}
