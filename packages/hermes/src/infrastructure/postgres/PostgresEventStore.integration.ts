import { createMockLogger } from "@lindorm/logger";
import { IPostgresSource, PostgresSource } from "@lindorm/postgres";
import { randomUUID } from "crypto";
import { subDays } from "@lindorm/date";
import { TEST_AGGREGATE_IDENTIFIER } from "../../__fixtures__/aggregate";
import { EVENT_STORE } from "../../constants/private";
import { IEventStore } from "../../interfaces";
import { AggregateIdentifier, EventStoreAttributes } from "../../types";
import { createChecksum } from "../../utils/private";
import { PostgresEventStore } from "./PostgresEventStore";

const insert = async (
  source: IPostgresSource,
  attributes: EventStoreAttributes,
): Promise<void> => {
  const queryBuilder = source.queryBuilder<EventStoreAttributes>(EVENT_STORE);
  await source.query(queryBuilder.insert(attributes));
};

const find = async (
  source: IPostgresSource,
  filter: AggregateIdentifier,
): Promise<Array<EventStoreAttributes>> => {
  const queryBuilder = source.queryBuilder<EventStoreAttributes>(EVENT_STORE);
  const result = await source.query<EventStoreAttributes>(
    queryBuilder.select(
      {
        aggregate_id: filter.id,
        aggregate_name: filter.name,
        aggregate_context: filter.context,
      },
      {
        order: { expected_events: "ASC" },
      },
    ),
  );
  return result.rows;
};

describe("PostgresEventStore", () => {
  const logger = createMockLogger();

  let aggregateIdentifier: AggregateIdentifier;
  let attributes: EventStoreAttributes;
  let causationId: string;
  let source: IPostgresSource;
  let store: IEventStore;

  beforeAll(async () => {
    source = new PostgresSource({
      logger,
      url: "postgres://root:example@localhost:5432/default",
    });

    store = new PostgresEventStore(source, logger);

    // @ts-expect-error
    await store.initialise();
  }, 10000);

  beforeEach(() => {
    causationId = randomUUID();
    aggregateIdentifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };

    const data: EventStoreAttributes = {
      aggregate_id: aggregateIdentifier.id,
      aggregate_name: aggregateIdentifier.name,
      aggregate_context: aggregateIdentifier.context,
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
        ...aggregateIdentifier,
        causation_id: causationId,
      }),
    ).resolves.toEqual([attributes]);
  });

  test("should insert events", async () => {
    await expect(store.insert([attributes])).resolves.not.toThrow();

    await expect(find(source, { ...aggregateIdentifier })).resolves.toEqual([attributes]);
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
