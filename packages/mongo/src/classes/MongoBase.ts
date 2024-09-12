import { ILogger } from "@lindorm/logger";
import { Collection, Document, IndexSpecification, MongoClient } from "mongodb";
import { MongoRepositoryError } from "../errors";
import { MongoBaseIndex, MongoBaseOptions, MongoIndexOptions } from "../types";

export abstract class MongoBase<D extends Document> {
  protected readonly client: MongoClient;
  protected readonly collectionName: string;
  protected readonly databaseName: string;
  protected readonly indexes: Array<MongoIndexOptions<D>>;
  protected readonly logger: ILogger;

  protected _collection: Collection<D> | undefined;

  protected constructor(options: MongoBaseOptions<D>) {
    this.logger = options.logger.child(["MongoBase"]);

    this.collectionName = options.collectionName;
    this.databaseName = options.databaseName;
    this.indexes = options.indexes;
    this.client = options.client;
  }

  // getters

  protected get collection(): Collection<any> {
    if (!this._collection) {
      this._collection = this.client
        .db(this.databaseName)
        .collection(this.collectionName);
    }

    return this._collection;
  }

  // public

  public async setup(): Promise<void> {
    const indexes: Array<MongoBaseIndex> = this.indexes.map((item) => ({
      index: item.index as IndexSpecification,
      options: {
        unique: item.unique ?? false,
        ...(item.name ? { name: item.name } : {}),
        ...(item.nullable?.length
          ? {
              partialFilterExpression: item.nullable.reduce(
                (obj, key) => ({ ...obj, [key]: { $exists: true } }),
                {},
              ),
            }
          : {}),
        ...(item.options ?? {}),
      },
    }));

    for (const { index, options } of indexes) {
      this.logger.debug("Creating index", { index, options });

      try {
        const result = await this.collection.createIndex(index, options);

        this.logger.silly("Index created", { result });
      } catch (error: any) {
        this.logger.silly("Mongo setup error", error);

        throw new MongoRepositoryError(error.message, { error });
      }
    }
  }
}
