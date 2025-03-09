import { ILogger } from "@lindorm/logger";
import { Collection, Db, Document, MongoClient } from "mongodb";
import { MongoRepositoryError } from "../errors";
import { MongoBaseIndex, MongoBaseOptions } from "../types";

export abstract class MongoBase<D extends Document> {
  protected readonly client: MongoClient;
  protected readonly collectionName: string;
  protected readonly databaseName: string;
  protected readonly indexes: Array<MongoBaseIndex>;
  protected readonly logger: ILogger;

  protected _collection: Collection<D> | undefined;
  protected _database: Db | undefined;

  protected constructor(options: MongoBaseOptions) {
    this.logger = options.logger.child(["MongoBase"]);

    this.collectionName = options.collection;
    this.databaseName = options.database;
    this.indexes = options.indexes;
    this.client = options.client;
  }

  // getters

  protected get collection(): Collection<any> {
    if (!this._collection) {
      this._collection = this.database.collection(this.collectionName);
    }
    return this._collection;
  }

  protected get database(): Db {
    if (!this._database) {
      this._database = this.client.db(this.databaseName);
    }
    return this._database;
  }

  // public

  public async setup(): Promise<void> {
    for (const { index, options } of this.indexes) {
      this.logger.debug("Creating index", {
        collection: this.collectionName,
        index,
        options,
      });

      try {
        const result = await this.collection.createIndex(index, options);

        this.logger.silly("Index created", { result });
      } catch (error: any) {
        this.logger.silly("Mongo setup error", error);

        throw new MongoRepositoryError(error.message, {
          debug: { collection: this.collectionName, index, options },
          error,
        });
      }
    }
  }
}
