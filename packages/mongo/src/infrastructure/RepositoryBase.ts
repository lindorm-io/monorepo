import { Collection, IndexSpecification } from "mongodb";
import { EntityAttributes } from "@lindorm-io/entity";
import { Logger } from "@lindorm-io/core-logger";
import { IndexOptions, LindormRepositoryOptions } from "../types";
import { MongoConnection } from "../connection";

export abstract class RepositoryBase<Interface extends EntityAttributes> {
  protected readonly collectionName: string;
  protected readonly connection: MongoConnection;
  protected readonly indices: Array<IndexOptions<Interface>>;
  protected readonly logger: Logger;

  protected collection: Collection | undefined;
  protected promise: () => Promise<void>;

  protected constructor(options: LindormRepositoryOptions<Interface>) {
    this.collectionName = options.collection;
    this.connection = options.connection;
    this.indices = [
      {
        index: { id: 1 },
        options: { unique: true },
      },
      ...options.indices,
    ];

    this.logger = options.logger.createChildLogger(["RepositoryBase", this.constructor.name]);
    this.promise = this.initialise;
  }

  public async initialise(): Promise<void> {
    const start = Date.now();

    await this.connection.connect();

    this.collection = this.connection.collection(this.collectionName);

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
      indices: this.indices,
      time: Date.now() - start,
    });

    this.promise = (): Promise<void> => Promise.resolve();
  }
}
