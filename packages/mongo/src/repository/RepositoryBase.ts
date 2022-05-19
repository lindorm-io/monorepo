import { Collection, Db, IndexSpecification } from "mongodb";
import { EntityAttributes } from "@lindorm-io/entity";
import { IndexOptions, LindormRepositoryOptions } from "../types";
import { Logger } from "@lindorm-io/winston";
import { MongoConnection } from "../infrastructure";

export abstract class RepositoryBase<Interface extends EntityAttributes> {
  protected readonly collectionName: string;
  protected readonly connection: MongoConnection;
  protected readonly indices: Array<IndexOptions<Interface>>;
  protected readonly logger: Logger;
  protected collection: Collection | undefined;
  protected db: Db;
  protected promise: () => Promise<void>;

  protected constructor(options: LindormRepositoryOptions<Interface>) {
    this.connection = options.connection;
    this.collectionName = options.collectionName;
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

    await this.connection.waitForConnection();
    this.db = this.connection.database();
    this.collection = await this.db.collection(this.collectionName);

    for (const { index, options } of this.indices) {
      for (const [key, value] of Object.entries(index)) {
        if (value !== 1 && value !== 0) {
          throw new Error(`Index [ ${key} ] has invalid value [ ${value} ]`);
        }
      }

      await this.collection.createIndex(index as IndexSpecification, options);
    }

    this.logger.debug("setup", {
      indices: this.indices,
      result: { success: true },
      time: Date.now() - start,
    });

    this.promise = (): Promise<void> => Promise.resolve();
  }
}
