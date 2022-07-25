import { Aggregate } from "../entity";
import { AggregateIdentifier } from "../types";
import { CausationMissingEventsError } from "../error";
import { Command } from "../message";
import { EventStore } from "./EventStore";
import { MongoConnection } from "@lindorm-io/mongo";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import { TEST_COMMAND, TEST_COMMAND_CREATE } from "../fixtures/command.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import {
  TEST_AGGREGATE_EVENT_HANDLER,
  TEST_AGGREGATE_EVENT_HANDLER_CREATE,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY_NEXT,
  TEST_AGGREGATE_EVENT_HANDLER_MERGE_STATE,
  TEST_AGGREGATE_EVENT_HANDLER_SET_STATE,
  TEST_AGGREGATE_EVENT_HANDLER_THROWS,
} from "../fixtures/aggregate-event-handler.fixture";

describe("EventStore", () => {
  const logger = createMockLogger();
  const eventHandlers = [
    TEST_AGGREGATE_EVENT_HANDLER,
    TEST_AGGREGATE_EVENT_HANDLER_CREATE,
    TEST_AGGREGATE_EVENT_HANDLER_DESTROY,
    TEST_AGGREGATE_EVENT_HANDLER_DESTROY_NEXT,
    TEST_AGGREGATE_EVENT_HANDLER_MERGE_STATE,
    TEST_AGGREGATE_EVENT_HANDLER_SET_STATE,
    TEST_AGGREGATE_EVENT_HANDLER_THROWS,
  ];

  let aggregate: AggregateIdentifier;
  let connection: MongoConnection;
  let store: EventStore;

  beforeAll(async () => {
    connection = new MongoConnection({
      host: "localhost",
      port: 27011,
      auth: { username: "root", password: "example" },
      logger,
      database: "db",
    });

    store = new EventStore({ connection, logger });

    await connection.connect();
  }, 30000);

  beforeEach(() => {
    aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should save new aggregate", async () => {
    const entity = new Aggregate({ ...aggregate, eventHandlers }, logger);
    const command = new Command({ ...TEST_COMMAND_CREATE, aggregate });

    await entity.apply(command, "domainEventCreate", { created: true });

    await expect(store.save(entity, command)).resolves.toStrictEqual([
      expect.objectContaining({
        id: expect.any(String),
        name: "domainEventCreate",
        aggregate,
        causationId: command.id,
        correlationId: command.correlationId,
        data: { created: true },
        delay: 0,
        mandatory: false,
        routingKey: "aggregateContext.aggregateName.domainEventCreate",
        timestamp: expect.any(Date),
        type: "domain_event",
      }),
    ]);
  }, 10000);

  test("should skip saving on matching causation id", async () => {
    const entity = new Aggregate({ ...aggregate, eventHandlers }, logger);
    const command = new Command({ ...TEST_COMMAND_CREATE, aggregate });

    await entity.apply(command, "domainEventCreate", { created: true });
    const events = await store.save(entity, command);

    await expect(store.save(entity, command)).resolves.toStrictEqual(events);
  }, 10000);

  test("should throw on causation missing events", async () => {
    const entity = new Aggregate({ ...aggregate, eventHandlers }, logger);
    const command = new Command({ ...TEST_COMMAND_CREATE, aggregate });

    await entity.apply(command, "domainEventCreate", { created: true });

    await expect(store.save(entity, new Command({ ...TEST_COMMAND, aggregate }))).rejects.toThrow(
      CausationMissingEventsError,
    );
  }, 10000);

  test("should load new aggregate", async () => {
    await expect(store.load(aggregate, eventHandlers)).resolves.toStrictEqual(
      expect.objectContaining({
        id: aggregate.id,
        name: "aggregateName",
        context: "aggregateContext",
        destroyed: false,
        events: [],
        numberOfLoadedEvents: 0,
        state: {},
      }),
    );
  }, 10000);

  test("should load saved aggregate", async () => {
    const entity = new Aggregate({ ...aggregate, eventHandlers }, logger);
    const command = new Command({ ...TEST_COMMAND_CREATE, aggregate });

    await entity.apply(command, "domainEventCreate", { created: true });
    await entity.apply(command, "domainEventMergeState", { merge: { state: true } });
    await entity.apply(command, "domainEventSetState", { setState: ["content"] });

    await store.save(entity, command);

    await expect(store.load(aggregate, eventHandlers)).resolves.toStrictEqual(
      expect.objectContaining({
        id: aggregate.id,
        name: "aggregateName",
        context: "aggregateContext",
        destroyed: false,
        events: [
          expect.objectContaining({
            name: "domainEventCreate",
          }),
          expect.objectContaining({
            name: "domainEventMergeState",
          }),
          expect.objectContaining({
            name: "domainEventSetState",
          }),
        ],
        numberOfLoadedEvents: 3,
        state: {
          created: true,
          merge: {
            merge: {
              state: true,
            },
          },
          path: {
            value: {
              setState: ["content"],
            },
          },
        },
      }),
    );
  }, 10000);
});
