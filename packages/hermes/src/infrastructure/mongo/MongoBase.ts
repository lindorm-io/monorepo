import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { Dict } from "@lindorm/types";
import { CreateIndexesOptions, IndexSpecification } from "mongodb";
import { MongoIndex, StoreIndexes } from "../../types";

export abstract class MongoBase {
  protected readonly source: IMongoSource;
  protected readonly logger: ILogger;

  protected constructor(source: IMongoSource, logger: ILogger) {
    this.source = source;
    this.logger = logger.child(["MongoBase", this.constructor.name]);
  }

  // protected

  protected async connect(): Promise<void> {
    await this.source.connect();
  }

  protected async createIndexes<F extends Dict = Dict>(
    name: string,
    indexes: StoreIndexes<F>,
  ): Promise<void> {
    const collection = this.source.collection(name);

    const mongo: Array<MongoIndex> = [];

    for (const item of indexes) {
      const indexSpecification: IndexSpecification = {};

      const createIndexesOptions: CreateIndexesOptions = {
        name: item.name,
        unique: item.unique || false,
      };

      for (const field of item.fields) {
        indexSpecification[field as string] = 1;
      }

      mongo.push({ indexSpecification, createIndexesOptions });
    }

    for (const { indexSpecification, createIndexesOptions } of mongo) {
      await collection.createIndex(indexSpecification, createIndexesOptions);
    }
  }
}
