import { Collection, IndexSpecification } from "mongodb";
import { EntityAttributes } from "@lindorm-io/entity";
import { ILogger } from "@lindorm-io/winston";
import { IndexOptions, LindormRepositoryOptions } from "../types";
import { MongoConnection } from "../infrastructure";
import { LindormError } from "@lindorm-io/errors";

export abstract class RepositoryBase<Interface extends EntityAttributes> {
  protected readonly collectionName: string;
  protected readonly connection: MongoConnection;
  protected readonly databaseName: string;
  protected readonly indices: Array<IndexOptions<Interface>>;
  protected readonly logger: ILogger;

  protected collection: Collection | undefined;
  protected promise: () => Promise<void>;

  protected constructor(options: LindormRepositoryOptions<Interface>) {
    this.collectionName = options.collection;
    this.connection = options.connection;
    this.databaseName = options.database || options.connection.database;
    this.indices = [
      {
        index: { id: 1 },
        options: { unique: true },
      },
      ...options.indices,
    ];

    if (!this.databaseName) {
      throw new LindormError("Invalid database");
    }

    this.logger = options.logger.createChildLogger(["RepositoryBase", this.constructor.name]);
    this.promise = this.initialise;
  }

  public async initialise(): Promise<void> {
    const start = Date.now();

    await this.connection.connect();

    this.collection = this.connection.client.db(this.databaseName).collection(this.collectionName);

    for (const { index, options } of this.indices) {
      for (const [key, value] of Object.entries(index)) {
        if (value !== 1 && value !== 0) {
          throw new Error(`Index [ ${key} ] has invalid value [ ${value} ]`);
        }
      }

      await this.collection.createIndex(index as IndexSpecification, options);
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
