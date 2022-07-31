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
    connection = new MongoConnection(
      {
        host: "localhost",
        port: 27011,
        auth: { username: "root", password: "example" },
        authSource: "admin",
        database: "EventStore",
      },
      logger,
    );

    store = new EventStore({ mongo: connection, type: "mongo" }, logger);

    await connection.connect();
  }, 10000);

  beforeEach(() => {
    aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should throw on causation missing events", async () => {
    const entity = new Aggregate({ ...aggregate, eventHandlers }, logger);
    const previous = new Command({ ...TEST_COMMAND_CREATE, aggregate });

    await entity.apply(previous, "domain_event_create", { created: true });

    const command = new Command({ ...TEST_COMMAND, aggregate });

    await expect(store.save(entity, command)).rejects.toThrow(CausationMissingEventsError);
  });
});
