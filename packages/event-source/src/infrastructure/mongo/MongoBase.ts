import { CreateIndexesOptions, IndexSpecification } from "mongodb";
import { ILogger } from "@lindorm-io/winston";
import { IMongoConnection } from "@lindorm-io/mongo";
import { Attributes, MongoIndex, StoreIndexes } from "../../types";

export abstract class MongoBase {
  protected readonly connection: IMongoConnection;
  protected readonly logger: ILogger;

  protected constructor(connection: IMongoConnection, logger: ILogger) {
    this.connection = connection;
    this.logger = logger.createChildLogger(["MongoBase", this.constructor.name]);
  }

  // protected

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
