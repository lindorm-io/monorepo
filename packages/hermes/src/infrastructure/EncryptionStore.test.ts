import { AesKit } from "@lindorm/aes";
import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { IPostgresSource, PostgresSource } from "@lindorm/postgres";
import { createTestAggregateIdentifier } from "../__fixtures__/create-test-aggregate-identifier";
import { AggregateIdentifier } from "../types";
import { EncryptionStore } from "./EncryptionStore";

const runEncryptionStoreTests = (createStore: () => EncryptionStore) => {
  let store: EncryptionStore;
  let aggregate: AggregateIdentifier;

  beforeEach(() => {
    store = createStore();
    aggregate = createTestAggregateIdentifier();
  });

  test("should return undefined when inspecting unknown aggregate", async () => {
    await expect(store.inspect(aggregate)).resolves.toBeUndefined();
  });

  test("should generate keys and return AesKit on first load", async () => {
    const aes = await store.load(aggregate);

    expect(aes).toBeInstanceOf(AesKit);
    expect(aes.kryptos).toBeDefined();
    expect(aes.kryptos.id).toEqual(expect.any(String));
  });

  test("should store keys and return them on inspect after load", async () => {
    await store.load(aggregate);

    const attrs = await store.inspect(aggregate);

    expect(attrs).toBeDefined();
    expect(attrs).toEqual(
      expect.objectContaining({
        id: aggregate.id,
        name: aggregate.name,
        namespace: aggregate.namespace,
        key_id: expect.any(String),
        key_algorithm: expect.any(String),
        key_encryption: "A256GCM",
        key_type: expect.any(String),
        private_key: expect.any(String),
        public_key: expect.any(String),
        created_at: expect.any(Date),
      }),
    );
  });

  test("should return the same key on subsequent loads", async () => {
    const first = await store.load(aggregate);
    const second = await store.load(aggregate);

    expect(first.kryptos.id).toEqual(second.kryptos.id);
  });

  test("should generate different keys for different aggregates", async () => {
    const other = createTestAggregateIdentifier();

    const aesA = await store.load(aggregate);
    const aesB = await store.load(other);

    expect(aesA.kryptos.id).not.toEqual(aesB.kryptos.id);
  });

  test("should encrypt and decrypt a string round-trip", async () => {
    const aes = await store.load(aggregate);
    const plaintext = "hello world";

    const encrypted = aes.encrypt(plaintext, "encoded");
    const decrypted = aes.decrypt(encrypted);

    expect(decrypted).toEqual(plaintext);
  });

  test("should encrypt and decrypt a buffer round-trip (serialised)", async () => {
    const aes = await store.load(aggregate);
    const data = { foo: "bar", num: 42 };
    const buf = Buffer.from(JSON.stringify(data));

    const encrypted = aes.encrypt(buf, "serialised");
    const decrypted = aes.decrypt(encrypted);

    expect(JSON.parse(decrypted as string)).toEqual(data);
  });

  test("should encrypt and decrypt with a reloaded key", async () => {
    const aes1 = await store.load(aggregate);
    const plaintext = "sensitive data";

    const encrypted = aes1.encrypt(plaintext, "encoded");

    // Reload the key from the store (simulates a new process)
    const aes2 = await store.load(aggregate);

    const decrypted = aes2.decrypt(encrypted);

    expect(decrypted).toEqual(plaintext);
  });

  test("should use dir algorithm and A256GCM encryption by default", async () => {
    await store.load(aggregate);

    const attrs = await store.inspect(aggregate);

    expect(attrs!.key_algorithm).toEqual("dir");
    expect(attrs!.key_encryption).toEqual("A256GCM");
  });
};

describe("EncryptionStore", () => {
  const logger = createMockLogger();

  describe("with MongoSource", () => {
    let mongo: IMongoSource;

    beforeAll(async () => {
      mongo = new MongoSource({
        database: "EncryptionStoreTest",
        logger,
        url: "mongodb://root:example@localhost/admin?authSource=admin",
      });
      await mongo.setup();
    }, 10000);

    afterAll(async () => {
      await mongo.disconnect();
    });

    runEncryptionStoreTests(() => new EncryptionStore({ mongo, logger }));
  });

  describe("with PostgresSource", () => {
    let postgres: IPostgresSource;

    beforeAll(async () => {
      postgres = new PostgresSource({
        logger,
        url: "postgres://root:example@localhost:5432/default",
      });
      await postgres.setup();
    }, 10000);

    afterAll(async () => {
      await postgres.disconnect();
    });

    runEncryptionStoreTests(() => new EncryptionStore({ postgres, logger }));
  });
});
