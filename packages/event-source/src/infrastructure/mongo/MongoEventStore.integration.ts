import { AggregateIdentifier, EventStoreAttributes } from "../../types";
import { Collection } from "mongodb";
import { MongoConnection } from "@lindorm-io/mongo";
import { MongoEventStore } from "./MongoEventStore";
import { TEST_AGGREGATE_IDENTIFIER } from "../../fixtures/aggregate.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import { subDays } from "date-fns";

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
        port: 27011,
        auth: { username: "root", password: "example" },
        authSource: "admin",
        database: "MongoEventStore",
      },
      logger,
    );
    await connection.connect();

    collection = connection.database.collection("event_store");

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

    await collection.insertOne({
      ...identifier,
      causation_id: causationId,
      correlation_id: randomUUID(),
      events: [
        {
          id: randomUUID(),
          name: "event_name",
          data: { data: true },
          version: 3,
          timestamp: new Date(),
        },
      ],
      expected_events: 3,
      origin: "origin",
      originId: "originId",
      previous_event_id: randomUUID(),
      timestamp: new Date(),
    });

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
        data: {
          data: true,
        },
        origin: "origin",
        originId: "originId",
        timestamp: expect.any(Date),
        version: 3,
      }),
    ]);
  });

  test("should insert events", async () => {
    const causationId = randomUUID();

    await expect(
      store.insert({
        ...identifier,
        causation_id: causationId,
        correlation_id: randomUUID(),
        events: [
          {
            id: randomUUID(),
            name: "event_name",
            data: { stuff: "string" },
            version: 3,
            timestamp: new Date(),
          },
        ],
        expected_events: 3,
        origin: "origin",
        originId: randomUUID(),
        previous_event_id: randomUUID(),
        timestamp: new Date(),
      }),
    ).resolves.toBeUndefined();

    await expect(collection.findOne({ ...identifier })).resolves.toStrictEqual(
      expect.objectContaining({ causation_id: causationId }),
    );
  });

  test("should list events", async () => {
    const causationId = randomUUID();

    await collection.insertOne({
      ...identifier,
      causation_id: causationId,
      correlation_id: randomUUID(),
      events: [
        {
          id: randomUUID(),
          name: "event_name",
          data: { stuff: "string" },
          version: 3,
          timestamp: new Date(),
        },
      ],
      expected_events: 3,
      origin: "origin",
      originId: randomUUID(),
      previous_event_id: randomUUID(),
      timestamp: subDays(new Date(), 1),
    });

    await expect(store.listEvents(subDays(new Date(), 2), 100)).resolves.toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          causation_id: causationId,
        }),
      ]),
    );
  });
});
