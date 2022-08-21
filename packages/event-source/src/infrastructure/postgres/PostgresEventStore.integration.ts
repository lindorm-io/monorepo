import { AggregateIdentifier } from "../../types";
import { EventEntity } from "./entity";
import { PostgresConnection } from "@lindorm-io/postgres";
import { PostgresEventStore } from "./PostgresEventStore";
import { TEST_AGGREGATE_IDENTIFIER } from "../../fixtures/aggregate.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import { subDays } from "date-fns";

describe("PostgresEventStore", () => {
  const logger = createMockLogger();

  let identifier: AggregateIdentifier;
  let connection: PostgresConnection;
  let store: PostgresEventStore;

  beforeAll(async () => {
    connection = new PostgresConnection(
      {
        host: "localhost",
        port: 5432,
        username: "root",
        password: "example",
        database: "default_db",
        entities: [EventEntity],
        synchronize: true,
      },
      logger,
    );

    store = new PostgresEventStore(connection, logger);

    await connection.connect();
  }, 10000);

  beforeEach(() => {
    identifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should find events", async () => {
    const causationId = randomUUID();

    await connection.getRepository(EventEntity).insert({
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
      originator: randomUUID(),
      previous_event_id: randomUUID(),
      timestamp: new Date(),
    });

    await expect(
      store.find({
        ...identifier,
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
        origin: "origin",
        originator: expect.any(String),
        timestamp: expect.any(Date),
        version: 3,
      },
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
        originator: randomUUID(),
        previous_event_id: randomUUID(),
        timestamp: new Date(),
      }),
    ).resolves.toBeUndefined();

    await expect(
      connection.getRepository(EventEntity).findOneBy({
        ...identifier,
      }),
    ).resolves.toStrictEqual(expect.objectContaining({ causation_id: causationId }));
  });

  test("should list events", async () => {
    const causationId = randomUUID();

    await connection.getRepository(EventEntity).insert({
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
      originator: randomUUID(),
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
