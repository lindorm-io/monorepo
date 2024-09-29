import { JsonKit } from "@lindorm/json-kit";
import { createMockLogger } from "@lindorm/logger";
import { IPostgresSource, PostgresSource } from "@lindorm/postgres";
import { randomUUID } from "crypto";
import { subDays } from "date-fns";
import { TEST_AGGREGATE_IDENTIFIER } from "../../__fixtures__/aggregate";
import { IEventStore } from "../../interfaces";
import { AggregateIdentifier, EventStoreAttributes } from "../../types";
import { createChecksum } from "../../utils/private";
import { PostgresEventStore } from "./PostgresEventStore";

const insert = async (
  source: IPostgresSource,
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
    JsonKit.stringify(attributes.events),
    attributes.expected_events,
    attributes.previous_event_id,
    attributes.timestamp,
  ];
  await source.query(text, values);
};

const find = async (
  source: IPostgresSource,
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
  const result = await source.query<EventStoreAttributes>(text, values);
  return result.rows.length ? result.rows : [];
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
      logger: createMockLogger(),
      url: "postgres://root:example@localhost:5432/default",
    });

    store = new PostgresEventStore(source, logger);

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
    await source.disconnect();
  });

  test("should find events", async () => {
    await insert(source, attributes);

    await expect(
      store.find({
        ...aggregateIdentifier,
        causation_id: causationId,
      }),
    ).resolves.toEqual([
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

    await expect(find(source, { ...aggregateIdentifier })).resolves.toEqual([
      expect.objectContaining({ causation_id: causationId }),
    ]);
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
