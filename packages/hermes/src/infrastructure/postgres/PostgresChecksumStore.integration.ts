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
  const text = `
    INSERT INTO ${CHECKSUM_STORE} (
      id,
      name,
      context,
      event_id,
      checksum,
      timestamp
    ) VALUES ($1,$2,$3,$4,$5,$6)`;
  const values = [
    attributes.id,
    attributes.name,
    attributes.context,
    attributes.event_id,
    attributes.checksum,
    attributes.timestamp,
  ];
  await source.query(text, values);
};

const find = async (
  source: IPostgresSource,
  identifier: AggregateIdentifier,
): Promise<ChecksumStoreAttributes | undefined> => {
  const text = `
    SELECT *
    FROM
      ${CHECKSUM_STORE}
    WHERE 
      id = $1 AND
      name = $2 AND
      context = $3
    LIMIT 1
  `;
  const values = [identifier.id, identifier.name, identifier.context];
  const result = await source.query<ChecksumStoreAttributes>(text, values);
  return result.rows.length ? result.rows[0] : undefined;
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
      logger: createMockLogger(),
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

    await expect(find(source, { ...identifier })).resolves.toEqual(
      expect.objectContaining({
        event_id: eventId,
        checksum: "checksum",
      }),
    );
  });
});
