import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { randomUUID } from "crypto";
import { subDays } from "date-fns";
import { Collection } from "mongodb";
import { TEST_AGGREGATE_IDENTIFIER } from "../../__fixtures__/aggregate";
import { EVENT_STORE } from "../../constants/private";
import { IEventStore } from "../../interfaces";
import { AggregateIdentifier, EventStoreAttributes } from "../../types";
import { createChecksum } from "../../utils/private";
import { MongoEventStore } from "./MongoEventStore";

describe("MongoEventStore", () => {
  const logger = createMockLogger();

  let collection: Collection<EventStoreAttributes>;
  let identifier: AggregateIdentifier;
  let source: IMongoSource;
  let store: IEventStore;

  beforeAll(async () => {
    source = new MongoSource({
      database: "MongoEventStore",
      logger,
      url: "mongodb://root:example@localhost/admin?authSource=admin",
    });

    await source.setup();

    collection = source.database.collection(EVENT_STORE);

    store = new MongoEventStore(source, logger);
  }, 10000);

  beforeEach(() => {
    identifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
  });

  afterAll(async () => {
    await source.disconnect();
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
    ).resolves.toEqual([
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

    await expect(collection.findOne({ ...identifier })).resolves.toEqual(
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

    await expect(store.listEvents(subDays(new Date(), 2), 100)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          causation_id: causationId,
        }),
      ]),
    );
  });
});
