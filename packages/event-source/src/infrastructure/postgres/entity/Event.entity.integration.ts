import { EventEntity } from "./Event.entity";
import { PostgresConnection } from "@lindorm-io/postgres";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";

describe("EventEntity", () => {
  const logger = createMockLogger();

  let connection: PostgresConnection;

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

    await connection.connect();
  }, 30000);

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should create Event", async () => {
    const id = randomUUID();
    const aggregate_id = randomUUID();
    const aggregate_name = "aggregate_name";
    const aggregate_context = "aggregate_context";
    const causation_id = randomUUID();
    const correlation_id = randomUUID();

    const data = {
      stuff: "things",
      number: 1,
      array: ["Hello", 123, { yes: true }],
    };

    const repository = connection.getRepository(EventEntity);

    await expect(
      repository.save({
        id,
        name: "event_name",
        aggregate_id,
        aggregate_name,
        aggregate_context,
        causation_id,
        correlation_id,
        data,
        expected_events: 0,
        origin: "test",
        originator: null,
        previous_event_id: null,
        version: 1,
      }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        id,
        name: "event_name",
        aggregate_id,
        aggregate_name,
        aggregate_context,
        causation_id,
        correlation_id,
        data,
        expected_events: 0,
        origin: "test",
        originator: null,
        previous_event_id: null,
        timestamp: expect.any(Date),
        version: 1,
      }),
    );

    await expect(
      repository.findBy({
        aggregate_id,
        aggregate_name,
        aggregate_context,
      }),
    ).resolves.toStrictEqual([
      expect.objectContaining({
        id,
        name: "event_name",
        aggregate_id,
        aggregate_name,
        aggregate_context,
        causation_id,
        correlation_id,
        data,
        expected_events: 0,
        origin: "test",
        originator: null,
        previous_event_id: null,
        timestamp: expect.any(Date),
        version: 1,
      }),
    ]);
  }, 10000);

  test("should create Events in a transaction", async () => {
    const id_1 = randomUUID();
    const id_2 = randomUUID();
    const aggregate_id = randomUUID();
    const aggregate_name = "aggregate_name";
    const aggregate_context = "aggregate_context";
    const causation_id = randomUUID();
    const correlation_id = randomUUID();
    const previous_event_id = randomUUID();

    await expect(
      connection.transaction(async (manager) => {
        const repository = manager.getRepository(EventEntity);

        const saved = await repository.save({
          id: id_1,
          name: "event_name",
          aggregate_id,
          aggregate_name,
          aggregate_context,
          causation_id,
          correlation_id,
          data: { one: 1 },
          expected_events: 1,
          origin: "test",
          originator: null,
          previous_event_id,
          version: 1,
        });

        await repository.save({
          id: id_2,
          name: "otherEventName",
          aggregate_id,
          aggregate_name,
          aggregate_context,
          causation_id,
          correlation_id: saved.correlation_id,
          data: { two: 2 },
          expected_events: saved.expected_events + 1,
          origin: "test",
          originator: null,
          previous_event_id: saved.id,
          version: 1,
        });
      }),
    ).resolves.not.toThrow();

    await expect(
      connection.getRepository(EventEntity).findBy({
        aggregate_id,
        aggregate_name,
        aggregate_context,
      }),
    ).resolves.toStrictEqual([
      expect.objectContaining({
        id: id_1,
        name: "event_name",
        aggregate_id,
        aggregate_name,
        aggregate_context,
        causation_id,
        correlation_id,
        data: { one: 1 },
        expected_events: 1,
        origin: "test",
        originator: null,
        previous_event_id,
        timestamp: expect.any(Date),
        version: 1,
      }),
      expect.objectContaining({
        id: id_2,
        name: "otherEventName",
        aggregate_id,
        aggregate_name,
        aggregate_context,
        causation_id,
        correlation_id,
        data: { two: 2 },
        expected_events: 2,
        origin: "test",
        originator: null,
        previous_event_id: id_1,
        timestamp: expect.any(Date),
        version: 1,
      }),
    ]);
  }, 10000);

  test("should rollback transaction on expected_events constraint", async () => {
    const id_1 = randomUUID();
    const id_2 = randomUUID();
    const aggregate_id = randomUUID();
    const aggregate_name = "aggregate_name";
    const aggregate_context = "aggregate_context";
    const causation_id = randomUUID();
    const correlation_id = randomUUID();
    const previous_event_id = randomUUID();

    await expect(
      connection.transaction(async (manager) => {
        const repository = manager.getRepository(EventEntity);

        const saved = await repository.save({
          id: id_1,
          name: "event_name",
          aggregate_id,
          aggregate_name,
          aggregate_context,
          causation_id,
          correlation_id,
          data: { one: 1 },
          expected_events: 0,
          origin: "test",
          originator: null,
          previous_event_id: null,
          version: 1,
        });

        await repository.save({
          id: id_2,
          name: "otherEventName",
          aggregate_id,
          aggregate_name,
          aggregate_context,
          causation_id,
          correlation_id: saved.correlation_id,
          data: { two: 2 },
          expected_events: 0,
          origin: "test",
          originator: null,
          previous_event_id,
          version: 1,
        });
      }),
    ).rejects.toThrow();

    await expect(
      connection.getRepository(EventEntity).findBy({
        aggregate_id,
        aggregate_name,
        aggregate_context,
      }),
    ).resolves.toStrictEqual([]);
  }, 10000);

  test("should rollback transaction on last_event constraint", async () => {
    const id_1 = randomUUID();
    const id_2 = randomUUID();
    const aggregate_id = randomUUID();
    const aggregate_name = "aggregate_name";
    const aggregate_context = "aggregate_context";
    const causation_id = randomUUID();
    const correlation_id = randomUUID();
    const previous_event_id = randomUUID();

    await expect(
      connection.transaction(async (manager) => {
        const repository = manager.getRepository(EventEntity);

        const saved = await repository.save({
          id: id_1,
          name: "event_name",
          aggregate_id,
          aggregate_name,
          aggregate_context,
          causation_id,
          correlation_id,
          data: { one: 1 },
          expected_events: 1,
          origin: "test",
          originator: null,
          previous_event_id,
          version: 1,
        });

        await repository.save({
          id: id_2,
          name: "otherEventName",
          aggregate_id,
          aggregate_name,
          aggregate_context,
          causation_id,
          correlation_id: saved.correlation_id,
          data: { two: 2 },
          expected_events: saved.expected_events + 1,
          origin: "test",
          originator: null,
          previous_event_id,
          version: 1,
        });
      }),
    ).rejects.toThrow();

    await expect(
      connection.getRepository(EventEntity).findBy({
        aggregate_id,
        aggregate_name,
        aggregate_context,
      }),
    ).resolves.toStrictEqual([]);
  }, 10000);
});
