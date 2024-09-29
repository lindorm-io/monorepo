import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { Collection, WithId } from "mongodb";
import { CHECKSUM_STORE, CHECKSUM_STORE_INDEXES } from "../../constants/private";
import { MongoDuplicateKeyError } from "../../errors";
import { IChecksumStore } from "../../interfaces";
import { ChecksumStoreAttributes, ChecksumStoreFindFilter } from "../../types";
import { MongoBase } from "./MongoBase";

export class MongoChecksumStore extends MongoBase implements IChecksumStore {
  private promise: () => Promise<void>;

  public constructor(source: IMongoSource, logger: ILogger) {
    super(source, logger);

    this.promise = this.initialise;
  }

  // public

  public async find(
    filter: ChecksumStoreFindFilter,
  ): Promise<ChecksumStoreAttributes | undefined> {
    this.logger.debug("Finding checksum document", { filter });

    await this.promise();

    try {
      const collection = await this.checksumCollection();

      const document = await collection.findOne(filter);

      if (!document) {
        this.logger.debug("Checksum document not found");

        return undefined;
      }

      this.logger.debug("Found checksum document", { document });

      return MongoChecksumStore.toChecksumData(document);
    } catch (err: any) {
      this.logger.error("Failed to find checksum document", err);

      throw err;
    }
  }

  public async insert(attributes: ChecksumStoreAttributes): Promise<void> {
    this.logger.debug("Inserting checksum document", { attributes });

    await this.promise();

    try {
      const collection = await this.checksumCollection();

      const result = await collection.insertOne({
        id: attributes.id,
        name: attributes.name,
        context: attributes.context,
        event_id: attributes.event_id,
        checksum: attributes.checksum,
        timestamp: attributes.timestamp,
      });

      this.logger.verbose("Inserted checksum document", { result });
    } catch (err: any) {
      this.logger.error("Failed to insert checksum document", err);

      if (err.code === 11000) {
        throw new MongoDuplicateKeyError(err.message, err);
      }

      throw err;
    }
  }

  // private

  private async initialise(): Promise<void> {
    await this.connect();
    await this.createIndexes(CHECKSUM_STORE, CHECKSUM_STORE_INDEXES);

    this.promise = (): Promise<void> => Promise.resolve();
  }

  private async checksumCollection(): Promise<Collection<ChecksumStoreAttributes>> {
    return this.source.database.collection<ChecksumStoreAttributes>(CHECKSUM_STORE);
  }

  // private static

  private static toChecksumData(
    document: WithId<ChecksumStoreAttributes>,
  ): ChecksumStoreAttributes {
    return {
      id: document.id,
      name: document.name,
      context: document.context,
      event_id: document.event_id,
      checksum: document.checksum,
      timestamp: document.timestamp,
    };
  }
}
