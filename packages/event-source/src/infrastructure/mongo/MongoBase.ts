import { ILogger } from "@lindorm-io/winston";
import { IMongoConnection } from "@lindorm-io/mongo";
import { MongoIndex } from "../../types";

export abstract class MongoBase {
  protected readonly connection: IMongoConnection;
  protected readonly logger: ILogger;

  protected constructor(connection: IMongoConnection, logger: ILogger) {
    this.connection = connection;
    this.logger = logger.createChildLogger(["MongoBase", this.constructor.name]);
  }

  // protected

  protected async createIndices(name: string, indices: Array<MongoIndex>): Promise<void> {
    await this.connection.connect();

    const collection = this.connection.database.collection(name);

    for (const { indexSpecification, createIndexesOptions } of indices) {
      await collection.createIndex(indexSpecification, createIndexesOptions);
    }
  }
}
