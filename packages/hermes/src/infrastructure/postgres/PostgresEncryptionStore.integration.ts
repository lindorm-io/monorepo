import { createMockLogger } from "@lindorm/logger";
import { IPostgresSource, PostgresSource } from "@lindorm/postgres";
import { randomUUID } from "crypto";
import { TEST_AGGREGATE_IDENTIFIER } from "../../__fixtures__/aggregate";
import { ENCRYPTION_STORE } from "../../constants/private";
import { IEncryptionStore } from "../../interfaces";
import { AggregateIdentifier, EncryptionStoreAttributes } from "../../types";
import { PostgresEncryptionStore } from "./PostgresEncryptionStore";

const insert = async (
  source: IPostgresSource,
  attributes: EncryptionStoreAttributes,
): Promise<void> => {
  const queryBuilder = source.queryBuilder<EncryptionStoreAttributes>(ENCRYPTION_STORE);
  await source.query(queryBuilder.insert(attributes));
};

const find = async (
  source: IPostgresSource,
  filter: AggregateIdentifier,
): Promise<Array<EncryptionStoreAttributes>> => {
  const queryBuilder = source.queryBuilder<EncryptionStoreAttributes>(ENCRYPTION_STORE);
  const result = await source.query<EncryptionStoreAttributes>(
    queryBuilder.select({
      id: filter.id,
      name: filter.name,
      context: filter.context,
    }),
  );
  return result.rows;
};

describe("PostgresEncryptionStore", () => {
  const logger = createMockLogger();

  let attributes: EncryptionStoreAttributes;
  let source: IPostgresSource;
  let eventId: string;
  let identifier: AggregateIdentifier;
  let store: IEncryptionStore;

  beforeAll(async () => {
    source = new PostgresSource({
      logger,
      url: "postgres://root:example@localhost:5432/default",
    });

    await source.setup();

    store = new PostgresEncryptionStore(source, logger);

    // @ts-ignore
    await store.initialise();
  }, 10000);

  beforeEach(() => {
    eventId = randomUUID();
    identifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    attributes = {
      ...identifier,
      key_id: randomUUID(),
      key_algorithm: "ECDH-ES+A256KW",
      key_curve: "P-256",
      key_encryption: "A256GCM",
      key_type: "EC",
      private_key: "private_key",
      public_key: "public_key",
      created_at: new Date(),
    };
  });

  afterAll(async () => {
    await source.disconnect();
  });

  test("should find encryption", async () => {
    await insert(source, attributes);

    await expect(store.find(identifier)).resolves.toEqual(
      expect.objectContaining({
        ...attributes,
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
    await expect(store.insert(attributes)).resolves.toBeUndefined();

    await expect(find(source, identifier)).resolves.toEqual([
      expect.objectContaining({
        key_algorithm: "ECDH-ES+A256KW",
        key_curve: "P-256",
        key_encryption: "A256GCM",
        key_type: "EC",
        private_key: "private_key",
        public_key: "public_key",
      }),
    ]);
  });
});
