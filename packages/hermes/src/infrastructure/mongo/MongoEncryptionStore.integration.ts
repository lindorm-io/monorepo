import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { randomUUID } from "crypto";
import { Collection } from "mongodb";
import { TEST_AGGREGATE_IDENTIFIER } from "../../__fixtures__/aggregate";
import { ENCRYPTION_STORE } from "../../constants/private";
import { IEncryptionStore } from "../../interfaces";
import { AggregateIdentifier, EncryptionStoreAttributes } from "../../types";
import { MongoEncryptionStore } from "./MongoEncryptionStore";

describe("MongoEncryptionStore", () => {
  const logger = createMockLogger();

  let collection: Collection<EncryptionStoreAttributes>;
  let source: IMongoSource;
  let identifier: AggregateIdentifier;
  let store: IEncryptionStore;

  beforeAll(async () => {
    source = new MongoSource({
      database: "MongoEncryptionStore",
      logger,
      url: "mongodb://root:example@localhost/admin?authSource=admin",
    });

    await source.setup();

    collection = source.collection(ENCRYPTION_STORE);

    store = new MongoEncryptionStore(source, logger);
  }, 10000);

  beforeEach(() => {
    identifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
  });

  afterAll(async () => {
    await source.disconnect();
  });

  test("should find encryption", async () => {
    await collection.insertOne({
      ...identifier,
      key_id: randomUUID(),
      key_algorithm: "ECDH-ES+A256KW",
      key_curve: "P-256",
      key_encryption: "A256GCM",
      key_type: "EC",
      private_key: "private_key",
      public_key: "public_key",
      timestamp: new Date(),
    });

    await expect(store.find(identifier)).resolves.toEqual(
      expect.objectContaining({
        key_algorithm: "ECDH-ES+A256KW",
        key_curve: "P-256",
        key_encryption: "A256GCM",
        key_type: "EC",
        private_key: "private_key",
        public_key: "public_key",
      }),
    );
  });

  test("should insert encryption", async () => {
    await expect(
      store.insert({
        ...identifier,
        key_id: randomUUID(),
        key_algorithm: "ECDH-ES+A256KW",
        key_curve: "P-256",
        key_encryption: "A256GCM",
        key_type: "EC",
        private_key: "private_key",
        public_key: "public_key",
        timestamp: new Date(),
      }),
    ).resolves.toBeUndefined();

    expect(await collection.findOne({ ...identifier })).toEqual(
      expect.objectContaining({
        key_algorithm: "ECDH-ES+A256KW",
        key_curve: "P-256",
        key_encryption: "A256GCM",
        key_type: "EC",
        private_key: "private_key",
        public_key: "public_key",
      }),
    );
  });
});
