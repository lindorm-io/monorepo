import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { randomUUID } from "crypto";
import { Collection } from "mongodb";
import { createTestAggregateIdentifier } from "../../__fixtures__/create-test-aggregate-identifier";
import { ENCRYPTION_STORE } from "../../constants/private";
import { IEncryptionStore } from "../../interfaces";
import { AggregateIdentifier, EncryptionStoreAttributes } from "../../types";
import { MongoEncryptionStore } from "./MongoEncryptionStore";

describe("MongoEncryptionStore", () => {
  const namespace = "mon_enc_sto";
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let collection: Collection<EncryptionStoreAttributes>;
  let source: IMongoSource;
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
    aggregate = createTestAggregateIdentifier(namespace);
  });

  afterAll(async () => {
    await source.disconnect();
  });

  test("should find encryption", async () => {
    await collection.insertOne({
      ...aggregate,
      key_id: randomUUID(),
      key_algorithm: "ECDH-ES+A256KW",
      key_curve: "P-256",
      key_encryption: "A256GCM",
      key_type: "EC",
      private_key: "private_key",
      public_key: "public_key",
      created_at: new Date(),
    });

    await expect(store.find(aggregate)).resolves.toEqual(
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
        ...aggregate,
        key_id: randomUUID(),
        key_algorithm: "ECDH-ES+A256KW",
        key_curve: "P-256",
        key_encryption: "A256GCM",
        key_type: "EC",
        private_key: "private_key",
        public_key: "public_key",
        created_at: new Date(),
      }),
    ).resolves.toBeUndefined();

    expect(await collection.findOne({ ...aggregate })).toEqual(
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
