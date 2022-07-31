import { Collection } from "mongodb";
import { ILogger } from "@lindorm-io/winston";
import { IMongoConnection } from "@lindorm-io/mongo";
import { MongoIndex, MongoBaseOptions } from "../../types";

export abstract class MongoBase<Attributes> {
  protected readonly collectionName: string;
  protected readonly connection: IMongoConnection;
  protected readonly indices: Array<MongoIndex>;
  protected readonly logger: ILogger;

  protected collection: Collection<Attributes>;
  protected promise: () => Promise<void>;

  protected constructor(options: MongoBaseOptions, logger: ILogger) {
    this.collectionName = options.collection;
    this.connection = options.connection;
    this.indices = options.indices || [];
    this.logger = logger.createChildLogger(["MongoBase", this.constructor.name]);

    this.promise = this.initialise;
  }

  // private

  private async initialise(): Promise<void> {
    await this.connection.connect();

    this.collection = this.connection.database.collection(this.collectionName);

    for (const { indexSpecification, createIndexesOptions } of this.indices) {
      await this.collection.createIndex(indexSpecification, createIndexesOptions);
    }

    this.logger.debug("Initialisation successful");

    this.promise = (): Promise<void> => Promise.resolve();
  }
}
