import { Collection } from "mongodb";
import { Logger } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { StoreBaseIndex, StoreBaseOptions } from "../types";

export abstract class MongoBase<Attributes> {
  protected readonly collectionName: string;
  protected readonly connection: MongoConnection;
  protected readonly databaseName: string;
  protected readonly indices: Array<StoreBaseIndex>;
  protected readonly logger: Logger;

  protected collection: Collection<Attributes>;
  protected promise: () => Promise<void>;

  protected constructor(options: StoreBaseOptions) {
    this.collectionName = options.collection;
    this.connection = options.connection;
    this.databaseName = options.database || options.connection.database;
    this.indices = options.indices || [];
    this.logger = options.logger.createChildLogger(["StoreBase", this.constructor.name]);

    this.promise = this.initialise;
  }

  // private

  private async initialise(): Promise<void> {
    const start = Date.now();

    await this.connection.connect();

    this.collection = this.connection.client.db(this.databaseName).collection(this.collectionName);

    for (const { indexSpecification, createIndexesOptions } of this.indices) {
      await this.collection.createIndex(indexSpecification, createIndexesOptions);
    }

    this.logger.debug("Initialisation successful", {
      collection: this.collectionName,
      database: this.databaseName,
      indices: this.indices,
      time: Date.now() - start,
    });

    this.promise = (): Promise<void> => Promise.resolve();
  }
}
