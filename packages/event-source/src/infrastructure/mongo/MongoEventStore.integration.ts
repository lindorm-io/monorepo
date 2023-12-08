import { createMockLogger } from "@lindorm-io/core-logger";
import { MongoConnection } from "@lindorm-io/mongo";
import { randomUUID } from "crypto";
import { subDays } from "date-fns";
import { Collection } from "mongodb";
import { EVENT_STORE } from "../../constant";
import { TEST_AGGREGATE_IDENTIFIER } from "../../fixtures/aggregate.fixture";
import { AggregateIdentifier, EventStoreAttributes } from "../../types";
import { createChecksum } from "../../util";
import { MongoEventStore } from "./MongoEventStore";

describe("MongoEventStore", () => {
  const logger = createMockLogger();

  let collection: Collection<EventStoreAttributes>;
  let connection: MongoConnection;
  let identifier: AggregateIdentifier;
  let store: MongoEventStore;

  beforeAll(async () => {
    connection = new MongoConnection(
      {
        host: "localhost",
        port: 5004,
        auth: { username: "root", password: "example" },
        authSource: "admin",
        database: "MongoEventStore",
      },
      logger,
    );
    await connection.connect();

    collection = connection.database.collection(EVENT_STORE);

    store = new MongoEventStore(connection, logger);
  }, 10000);

  beforeEach(() => {
    identifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should find events", async () => {
    const causationId = randomUUID();

    const attributes = {
      ...identifier,
      causation_id: causationId,
      correlation_id: randomUUID(),
      events: [
        {
          id: randomUUID(),
          name: "event_name",
          data: { data: true },
          meta: { meta: true },
          version: 3,
          timestamp: new Date(),
        },
      ],
      expected_events: 3,
      previous_event_id: randomUUID(),
      timestamp: new Date(),
    };

    const checksum = createChecksum(attributes);

    await collection.insertOne({ ...attributes, checksum });

    await expect(
      store.find({
        ...identifier,
        causation_id: causationId,
      }),
    ).resolves.toStrictEqual([
      expect.objectContaining({
        id: expect.any(String),
        name: "event_name",
        aggregate: {
          id: identifier.id,
          name: "aggregate_name",
          context: "default",
        },
        causation_id: causationId,
        correlation_id: expect.any(String),
        data: { data: true },
        meta: { meta: true },
        timestamp: expect.any(Date),
        version: 3,
      }),
    ]);
  });

  test("should insert events", async () => {
    const causationId = randomUUID();

    const attributes = {
      ...identifier,
      causation_id: causationId,
      correlation_id: randomUUID(),
      events: [
        {
          id: randomUUID(),
          name: "event_name",
          data: { stuff: "string" },
          meta: { meta: true },
          version: 3,
          timestamp: new Date(),
        },
      ],
      expected_events: 3,
      previous_event_id: randomUUID(),
      timestamp: new Date(),
    };

    const checksum = createChecksum(attributes);

    await expect(store.insert({ ...attributes, checksum })).resolves.toBeUndefined();

    await expect(collection.findOne({ ...identifier })).resolves.toStrictEqual(
      expect.objectContaining({ causation_id: causationId }),
    );
  });

  test("should list events", async () => {
    const causationId = randomUUID();

    const attributes = {
      ...identifier,
      causation_id: causationId,
      correlation_id: randomUUID(),
      events: [
        {
          id: randomUUID(),
          name: "event_name",
          data: { stuff: "string" },
          meta: { meta: true },
          version: 3,
          timestamp: new Date(),
        },
      ],
      expected_events: 3,
      previous_event_id: randomUUID(),
      timestamp: subDays(new Date(), 1),
    };

    const checksum = createChecksum(attributes);

    await collection.insertOne({ ...attributes, checksum });

    await expect(store.listEvents(subDays(new Date(), 2), 100)).resolves.toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          causation_id: causationId,
        }),
      ]),
    );
  });
});
