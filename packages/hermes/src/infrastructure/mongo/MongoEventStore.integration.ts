import { subDays } from "@lindorm/date";
import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { randomUUID } from "crypto";
import { createTestAggregateIdentifier } from "../../__fixtures__/create-test-aggregate-identifier";
import { EVENT_STORE } from "../../constants/private";
import { IEventStore } from "../../interfaces";
import {
  AggregateIdentifier,
  EventStoreAttributes,
  MongoEventStoreDocument,
} from "../../types";
import { createChecksum } from "../../utils/private";
import { MongoEventStore } from "./MongoEventStore";

const insert = async (
  source: IMongoSource,
  attributes: EventStoreAttributes,
): Promise<void> => {
  const collection = source.database.collection(EVENT_STORE);
  await collection.insertOne(
    // @ts-expect-error
    MongoEventStore.toDocument([attributes]),
  );
};

const find = async (
  source: IMongoSource,
  filter: AggregateIdentifier,
): Promise<Array<EventStoreAttributes>> => {
  const collection = source.database.collection(EVENT_STORE);
  const result = await collection
    .find<MongoEventStoreDocument>(
      {
        aggregate_id: filter.id,
        aggregate_name: filter.name,
        aggregate_context: filter.context,
      },
      {
        sort: { expected_events: 1 },
      },
    )
    .toArray();
  // @ts-expect-error
  return MongoEventStore.toAttributes(result);
};

describe("MongoEventStore", () => {
  const namespace = "mon_eve_sto";
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let attributes: EventStoreAttributes;
  let causationId: string;
  let source: IMongoSource;
  let store: IEventStore;

  beforeAll(async () => {
    source = new MongoSource({
      database: "MongoEventStore",
      logger,
      url: "mongodb://root:example@localhost/admin?authSource=admin",
    });

    await source.setup();

    store = new MongoEventStore(source, logger);
  }, 10000);

  beforeEach(() => {
    aggregate = createTestAggregateIdentifier(namespace);
    causationId = randomUUID();

    const data: EventStoreAttributes = {
      aggregate_id: aggregate.id,
      aggregate_name: aggregate.name,
      aggregate_context: aggregate.context,
      causation_id: causationId,
      checksum: "",
      correlation_id: randomUUID(),
      data: { stuff: "string" },
      encrypted: false,
      event_id: randomUUID(),
      event_name: "event_name",
      event_timestamp: new Date(),
      expected_events: 3,
      meta: {
        origin: "origin",
        origin_id: randomUUID(),
      },
      previous_event_id: randomUUID(),
      created_at: new Date(),
      version: 3,
    };

    const checksum = createChecksum(data);

    attributes = { ...data, checksum };
  });

  afterAll(async () => {
    await source.disconnect();
  });

  test("should find events", async () => {
    await insert(source, attributes);

    await expect(
      store.find({
        id: aggregate.id,
        name: aggregate.name,
        context: aggregate.context,
        causation_id: causationId,
      }),
    ).resolves.toEqual([attributes]);
  });

  test("should insert events", async () => {
    await expect(store.insert([attributes])).resolves.not.toThrow();

    await expect(find(source, { ...aggregate })).resolves.toEqual([attributes]);
  });

  test("should list events", async () => {
    await insert(source, attributes);

    await expect(store.listEvents(subDays(new Date(), 2), 100)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          causation_id: causationId,
        }),
      ]),
    );
  });
});
