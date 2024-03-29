import { Logger } from "@lindorm-io/core-logger";
import { IMongoConnection } from "@lindorm-io/mongo";
import { CreateIndexesOptions, IndexSpecification } from "mongodb";
import { Attributes, MongoIndex, StoreIndexes } from "../../types";

export abstract class MongoBase {
  protected readonly connection: IMongoConnection;
  protected readonly logger: Logger;

  protected constructor(connection: IMongoConnection, logger: Logger) {
    this.connection = connection;
    this.logger = logger.createChildLogger(["MongoBase", this.constructor.name]);
  }

  // protected

  protected async connect(): Promise<void> {
    await this.connection.connect();
  }

  protected async createIndexes<TFields extends Attributes = Attributes>(
    name: string,
    indexes: StoreIndexes<TFields>,
  ): Promise<void> {
    const collection = this.connection.database.collection(name);

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
