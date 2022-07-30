import { ConnectionBase } from "@lindorm-io/core-connection";
import { ILogger } from "@lindorm-io/winston";
import { IMongoConnection, MongoConnectionOptions, WithTransactionCallback } from "../types";
import { uniqBy } from "lodash";
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
  private readonly custom: typeof MongoClient;
  private readonly dbName: string;
  private readonly dbOptions: DbOptions;
  private db: Db;

  public constructor(options: MongoConnectionOptions, logger: ILogger) {
    const {
      connectInterval,
      connectTimeout,
      database,
      databaseOptions,
      host = "localhost",
      port = 27017,
      custom,
      replicas = [],
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

    const hosts = uniqBy([{ host, port }, ...replicas], (item) => item.host && item.port);

    let url = "mongodb://" + hosts.map((item) => `${item.host}:${item.port},`);
    url = url.slice(0, -1);
    if (database) {
      url = `${url}/${database}`;
    }

    this.url = url;

    this.custom = custom;
    this.dbName = database;
    this.dbOptions = databaseOptions;
  }

  // public properties

  public get database(): Db {
    return this.db;
  }
  public set database(_: Db) {
    /* ignored */
  }

  // public

  public collection(collection: string, options?: CollectionOptions): Collection {
    return this.db.collection(collection, options);
  }

  public async withTransaction<Result = any, Options = any>(
    callback: WithTransactionCallback<Result, Options>,
    options?: Options,
  ): Promise<Result> {
    const session = await this.client.startSession();

    try {
      session.startTransaction();

      this.logger.verbose("Transaction started");

      const result = await callback({
        database: this.db,
        logger: this.logger,
        options: options || ({} as Options),
        session,

        collection: this.collection.bind(this),
      });

      await session.commitTransaction();

      this.logger.verbose("Transaction committed", { result });

      return result;
    } catch (err) {
      await session.abortTransaction();
      this.logger.error("Transaction failed", err);

      throw err;
    } finally {
      await session.endSession();
    }
  }

  // abstract implementation

  protected async createClientConnection(): Promise<MongoClient> {
    this.logger.debug("Connecting to Mongo", { url: this.url, options: this.connectOptions });

    if (this.custom) {
      return await this.custom.connect(this.url, this.connectOptions);
    }
    return await MongoClient.connect(this.url, this.connectOptions);
  }

  protected async connectCallback(): Promise<void> {
    this.client.on("error", this.onError.bind(this));

    this.db = this.client.db(this.dbName, this.dbOptions);
  }

  protected async disconnectCallback(): Promise<void> {
    await this.client.close();
  }
}
