import { Aggregate } from "../../entity";
import { AggregateIdentifier, EventStoreSaveOptions, IAggregate, IMessage } from "../../types";
import { Command, DomainEvent } from "../../message";
import { MongoConnection } from "@lindorm-io/mongo";
import { MongoEventStore } from "./MongoEventStore";
import { TEST_AGGREGATE_IDENTIFIER } from "../../fixtures/aggregate.fixture";
import { TEST_COMMAND_CREATE } from "../../fixtures/command.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import { filter, last, take } from "lodash";
import { randomUUID } from "crypto";
import {
  TEST_AGGREGATE_EVENT_HANDLER,
  TEST_AGGREGATE_EVENT_HANDLER_CREATE,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY_NEXT,
  TEST_AGGREGATE_EVENT_HANDLER_MERGE_STATE,
  TEST_AGGREGATE_EVENT_HANDLER_SET_STATE,
  TEST_AGGREGATE_EVENT_HANDLER_THROWS,
} from "../../fixtures/aggregate-event-handler.fixture";

const saveOptions = (aggregate: IAggregate, causation: IMessage): EventStoreSaveOptions => {
  const causationEvents = filter<DomainEvent>(aggregate.events, { causationId: causation.id });
  const expectedEvents = take<DomainEvent>(aggregate.events, aggregate.numberOfLoadedEvents);
  const lastExpectedEvent = last<DomainEvent>(expectedEvents);

  return {
    causationEvents,
    expectedEvents: expectedEvents.length,
    previousEventId: lastExpectedEvent ? lastExpectedEvent.id : null,
  };
};

describe("MongoEventStore", () => {
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

    store = new MongoEventStore(connection, logger);

    await connection.connect();
  }, 10000);

  beforeEach(() => {
    aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should save new aggregate", async () => {
    const entity = new Aggregate({ ...aggregate, eventHandlers }, logger);
    const command = new Command({ ...TEST_COMMAND_CREATE, aggregate });

    await entity.apply(command, "domain_event_create", { created: true });

    await expect(store.save(entity, command, saveOptions(entity, command))).resolves.toStrictEqual([
      expect.objectContaining({
        id: expect.any(String),
        name: "domain_event_create",
        aggregate,
        causationId: command.id,
        correlationId: command.correlationId,
        data: { created: true },
        delay: 0,
        mandatory: false,
        routingKey: "default.aggregate_name.domain_event_create",
        timestamp: expect.any(Date),
        type: "domain_event",
      }),
    ]);
  });

  test("should skip saving on matching causation id", async () => {
    const entity = new Aggregate({ ...aggregate, eventHandlers }, logger);
    const command = new Command({ ...TEST_COMMAND_CREATE, aggregate });

    await entity.apply(command, "domain_event_create", { created: true });
    const events = await store.save(entity, command, saveOptions(entity, command));

    await expect(store.save(entity, command, saveOptions(entity, command))).resolves.toStrictEqual(
      events,
    );
  });

  test("should load new aggregate", async () => {
    await expect(store.load(aggregate)).resolves.toStrictEqual([]);
  });

  test("should load saved aggregate", async () => {
    const entity = new Aggregate({ ...aggregate, eventHandlers }, logger);
    const command = new Command({ ...TEST_COMMAND_CREATE, aggregate });

    await entity.apply(command, "domain_event_create", { created: true });
    await entity.apply(command, "domain_event_merge_state", { merge: { state: true } });
    await entity.apply(command, "domain_event_set_state", { setState: ["content"] });

    await store.save(entity, command, saveOptions(entity, command));

    await expect(store.load(aggregate)).resolves.toStrictEqual([
      expect.objectContaining({
        name: "domain_event_create",
      }),
      expect.objectContaining({
        name: "domain_event_merge_state",
      }),
      expect.objectContaining({
        name: "domain_event_set_state",
      }),
    ]);
  });
});
