import { createMockLogger } from "@lindorm-io/core-logger";
import { PostgresConnection } from "@lindorm-io/postgres";
import { stringifyBlob } from "@lindorm-io/string-blob";
import { randomUUID } from "crypto";
import { subDays } from "date-fns";
import { TEST_AGGREGATE_IDENTIFIER } from "../../fixtures/aggregate.fixture";
import { AggregateIdentifier, EventStoreAttributes } from "../../types";
import { createChecksum } from "../../util";
import { PostgresEventStore } from "./PostgresEventStore";

const insert = async (
  connection: PostgresConnection,
  attributes: EventStoreAttributes,
): Promise<void> => {
  const text = `
    INSERT INTO event_store (
      id,
      name,
      context,
      causation_id,
      checksum,
      correlation_id,
      events,
      expected_events,
      previous_event_id,
      timestamp
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  `;
  const values = [
    attributes.id,
    attributes.name,
    attributes.context,
    attributes.causation_id,
    attributes.checksum,
    attributes.correlation_id,
    stringifyBlob(attributes.events),
    attributes.expected_events,
    attributes.previous_event_id,
    attributes.timestamp,
  ];
  await connection.query(text, values);
};

const find = async (
  connection: PostgresConnection,
  identifier: AggregateIdentifier,
): Promise<Array<EventStoreAttributes>> => {
  const text = `
    SELECT *
      FROM event_store
    WHERE 
      id = $1 AND
      name = $2 AND
      context = $3
    LIMIT 1
  `;
  const values = [identifier.id, identifier.name, identifier.context];
  const result = await connection.query<EventStoreAttributes>(text, values);
  return result.rows.length ? result.rows : [];
};

describe("PostgresEventStore", () => {
  const logger = createMockLogger();

  let aggregateIdentifier: AggregateIdentifier;
  let attributes: EventStoreAttributes;
  let causationId: string;
  let connection: PostgresConnection;
  let store: PostgresEventStore;

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

    store = new PostgresEventStore(connection, logger);

    // @ts-ignore
    await store.initialise();
  }, 10000);

  beforeEach(() => {
    causationId = randomUUID();
    aggregateIdentifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const data = {
      ...aggregateIdentifier,
      causation_id: causationId,
      correlation_id: randomUUID(),
      events: [
        {
          id: randomUUID(),
          name: "event_name",
          data: { stuff: "string" },
          meta: {
            origin: "origin",
            origin_id: randomUUID(),
          },
          version: 3,
          timestamp: new Date(),
        },
      ],
      expected_events: 3,
      previous_event_id: randomUUID(),
      timestamp: new Date(),
    };
    const checksum = createChecksum(data);
    attributes = { ...data, checksum };
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should find events", async () => {
    await insert(connection, attributes);

    await expect(
      store.find({
        ...aggregateIdentifier,
        causation_id: causationId,
      }),
    ).resolves.toStrictEqual([
      {
        id: expect.any(String),
        name: "event_name",
        aggregate: {
          id: expect.any(String),
          name: "aggregate_name",
          context: "default",
        },
        causation_id: causationId,
        correlation_id: expect.any(String),
        data: {
          stuff: "string",
        },
        meta: {
          origin: "origin",
          origin_id: expect.any(String),
        },
        timestamp: expect.any(Date),
        version: 3,
      },
    ]);
  });

  test("should insert events", async () => {
    await expect(store.insert(attributes)).resolves.toBeUndefined();

    await expect(find(connection, { ...aggregateIdentifier })).resolves.toStrictEqual([
      expect.objectContaining({ causation_id: causationId }),
    ]);
  });

  test("should list events", async () => {
    await insert(connection, attributes);

    await expect(store.listEvents(subDays(new Date(), 2), 100)).resolves.toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          causation_id: causationId,
        }),
      ]),
    );
  });
});
