import { createMockLogger } from "@lindorm/logger";
import { IPostgresSource, PostgresSource } from "@lindorm/postgres";
import { randomUUID } from "crypto";
import { TEST_AGGREGATE_IDENTIFIER } from "../../__fixtures__/aggregate";
import { CHECKSUM_STORE } from "../../constants/private";
import { IChecksumStore } from "../../interfaces";
import { AggregateIdentifier, ChecksumStoreAttributes } from "../../types";
import { PostgresChecksumStore } from "./PostgresChecksumStore";

const insert = async (
  source: IPostgresSource,
  attributes: ChecksumStoreAttributes,
): Promise<void> => {
  const queryBuilder = source.queryBuilder<ChecksumStoreAttributes>(CHECKSUM_STORE);
  await source.query(queryBuilder.insert(attributes));
};

const find = async (
  source: IPostgresSource,
  filter: AggregateIdentifier,
): Promise<Array<ChecksumStoreAttributes>> => {
  const queryBuilder = source.queryBuilder<ChecksumStoreAttributes>(CHECKSUM_STORE);
  const result = await source.query<ChecksumStoreAttributes>(
    queryBuilder.select({
      id: filter.id,
      name: filter.name,
      context: filter.context,
    }),
  );
  return result.rows;
};

describe("PostgresChecksumStore", () => {
  const logger = createMockLogger();

  let attributes: ChecksumStoreAttributes;
  let source: IPostgresSource;
  let eventId: string;
  let identifier: AggregateIdentifier;
  let store: IChecksumStore;

  beforeAll(async () => {
    source = new PostgresSource({
      logger,
      url: "postgres://root:example@localhost:5432/default",
    });

    await source.connect();

    store = new PostgresChecksumStore(source, logger);

    // @ts-ignore
    await store.initialise();
  }, 10000);

  beforeEach(() => {
    eventId = randomUUID();
    identifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    attributes = {
      ...identifier,
      event_id: eventId,
      checksum: "checksum",
      timestamp: new Date(),
    };
  });

  afterAll(async () => {
    await source.disconnect();
  });

  test("should find checksum", async () => {
    await insert(source, attributes);

    await expect(
      store.find({
        ...identifier,
        event_id: eventId,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ...attributes,
        event_id: eventId,
      }),
    );
  });

  test("should insert checksum", async () => {
    await expect(store.insert(attributes)).resolves.toBeUndefined();

    await expect(find(source, { ...identifier })).resolves.toEqual([
      expect.objectContaining({
        event_id: eventId,
        checksum: "checksum",
      }),
    ]);
  });
});
