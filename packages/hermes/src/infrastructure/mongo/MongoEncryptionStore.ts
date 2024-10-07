import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { Collection, WithId } from "mongodb";
import { ENCRYPTION_STORE, ENCRYPTION_STORE_INDEXES } from "../../constants/private";
import { MongoDuplicateKeyError } from "../../errors";
import { IEncryptionStore } from "../../interfaces";
import { EncryptionStoreAttributes, EncryptionStoreFindFilter } from "../../types";
import { MongoBase } from "./MongoBase";

export class MongoEncryptionStore extends MongoBase implements IEncryptionStore {
  private promise: () => Promise<void>;

  public constructor(source: IMongoSource, logger: ILogger) {
    super(source, logger);

    this.promise = this.initialise;
  }

  // public

  public async find(
    filter: EncryptionStoreFindFilter,
  ): Promise<EncryptionStoreAttributes | undefined> {
    this.logger.debug("Finding encryption document", { filter });

    await this.promise();

    try {
      const collection = await this.encryptionCollection();

      const document = await collection.findOne(filter);

      if (!document) {
        this.logger.debug("Encryption document not found");

        return undefined;
      }

      this.logger.debug("Found encryption document", { document });

      return MongoEncryptionStore.toAttributes(document);
    } catch (err: any) {
      this.logger.error("Failed to find encryption document", err);

      throw err;
    }
  }

  public async insert(attributes: EncryptionStoreAttributes): Promise<void> {
    this.logger.debug("Inserting encryption document", { attributes });

    await this.promise();

    try {
      const collection = await this.encryptionCollection();

      const result = await collection.insertOne({
        id: attributes.id,
        name: attributes.name,
        context: attributes.context,
        key_id: attributes.key_id,
        key_algorithm: attributes.key_algorithm,
        key_curve: attributes.key_curve,
        key_encryption: attributes.key_encryption,
        key_type: attributes.key_type,
        private_key: attributes.private_key,
        public_key: attributes.public_key,
        created_at: attributes.created_at,
      });

      this.logger.verbose("Inserted encryption document", { result });
    } catch (err: any) {
      this.logger.error("Failed to insert encryption document", err);

      if (err.code === 11000) {
        throw new MongoDuplicateKeyError(err.message, err);
      }

      throw err;
    }
  }

  // private

  private async initialise(): Promise<void> {
    await this.connect();
    await this.createIndexes(ENCRYPTION_STORE, ENCRYPTION_STORE_INDEXES);

    this.promise = (): Promise<void> => Promise.resolve();
  }

  private async encryptionCollection(): Promise<Collection<EncryptionStoreAttributes>> {
    return this.source.database.collection<EncryptionStoreAttributes>(ENCRYPTION_STORE);
  }

  // private static

  private static toAttributes(
    document: WithId<EncryptionStoreAttributes>,
  ): EncryptionStoreAttributes {
    return {
      id: document.id,
      name: document.name,
      context: document.context,
      key_id: document.key_id,
      key_algorithm: document.key_algorithm,
      key_curve: document.key_curve,
      key_encryption: document.key_encryption,
      key_type: document.key_type,
      private_key: document.private_key,
      public_key: document.public_key,
      created_at: document.created_at,
    };
  }
}
