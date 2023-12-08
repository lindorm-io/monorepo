import { createMockLogger } from "@lindorm-io/core-logger";
import { PostgresConnection } from "@lindorm-io/postgres";
import { randomUUID } from "crypto";
import { CHECKSUM_STORE } from "../../constant";
import { TEST_AGGREGATE_IDENTIFIER } from "../../fixtures/aggregate.fixture";
import { AggregateIdentifier, ChecksumStoreAttributes } from "../../types";
import { PostgresChecksumStore } from "./PostgresChecksumStore";

const insert = async (
  connection: PostgresConnection,
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
  await connection.query(text, values);
};

const find = async (
  connection: PostgresConnection,
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
  const result = await connection.query<ChecksumStoreAttributes>(text, values);
  return result.rows.length ? result.rows[0] : undefined;
};

describe("PostgresChecksumStore", () => {
  const logger = createMockLogger();

  let attributes: ChecksumStoreAttributes;
  let connection: PostgresConnection;
  let eventId: string;
  let identifier: AggregateIdentifier;
  let store: PostgresChecksumStore;

  beforeAll(async () => {
    connection = new PostgresConnection(
      {
        host: "localhost",
        port: 5003,
        user: "root",
        password: "example",
        database: "default_db",
      },
      logger,
    );
    await connection.connect();

    store = new PostgresChecksumStore(connection, logger);

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
    await connection.disconnect();
  });

  test("should find checksum", async () => {
    await insert(connection, attributes);

    await expect(
      store.find({
        ...identifier,
        event_id: eventId,
      }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        ...attributes,
        event_id: eventId,
      }),
    );
  });

  test("should insert checksum", async () => {
    await expect(store.insert(attributes)).resolves.toBeUndefined();

    await expect(find(connection, { ...identifier })).resolves.toStrictEqual(
      expect.objectContaining({
        event_id: eventId,
        checksum: "checksum",
      }),
    );
  });
});
