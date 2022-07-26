import { Aggregate } from "../entity";
import { AggregateIdentifier } from "../types";
import { CausationMissingEventsError } from "../error";
import { Command, DomainEvent } from "../message";
import { EventStore } from "./EventStore";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import { TEST_COMMAND, TEST_COMMAND_CREATE } from "../fixtures/command.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import { createMockMongoConnection } from "@lindorm-io/mongo";
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
import {
  TEST_DOMAIN_EVENT_CREATE,
  TEST_DOMAIN_EVENT_DESTROY,
  TEST_DOMAIN_EVENT_MERGE_STATE,
  TEST_DOMAIN_EVENT_SET_STATE,
} from "../fixtures/domain-event.fixture";

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

  let connection: any;
  let store: EventStore;
  let aggregate: AggregateIdentifier;

  let toArray: jest.Mock;
  let insertOne: jest.Mock;
  let find: jest.Mock;

  beforeEach(async () => {
    toArray = jest.fn().mockResolvedValue([]);
    insertOne = jest.fn();
    find = jest.fn().mockResolvedValue({ toArray });

    connection = createMockMongoConnection({ insertOne, find });

    aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };

    store = new EventStore({ connection, logger });
  }, 30000);

  test("should save new aggregate", async () => {
    const entity = new Aggregate({ ...aggregate, eventHandlers }, logger);
    const command = new Command({ ...TEST_COMMAND_CREATE, aggregate });

    await entity.apply(command, "domain_event_create", { created: true });

    await expect(store.save(entity, command)).resolves.toStrictEqual([
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

    expect(find).toHaveBeenCalledWith(
      {
        id: aggregate.id,
        name: "aggregate_name",
        context: "default",
        causationId: command.causationId,
      },
      {
        projection: {
          events: 1,
          loadEvents: 1,
        },
        sort: {
          loadEvents: 1,
        },
      },
    );

    expect(insertOne).toHaveBeenCalledWith({
      id: expect.any(String),
      name: "aggregate_name",
      context: "default",
      causationId: command.causationId,
      events: [
        {
          id: expect.any(String),
          name: "domain_event_create",
          causationId: command.causationId,
          correlationId: command.correlationId,
          data: { created: true },
          timestamp: expect.any(Date),
        },
      ],
      loadEvents: 0,
      revision: null,
      timestamp: expect.any(Date),
    });
  }, 10000);

  test("should skip saving on matching causation id", async () => {
    const entity = new Aggregate({ ...aggregate, eventHandlers }, logger);
    const command = new Command({ ...TEST_COMMAND_CREATE, aggregate });
    const eventCreate = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate }, command);

    await entity.apply(command, "domain_event_create", { created: true });

    toArray.mockResolvedValue([{ events: [eventCreate] }]);

    await expect(store.save(entity, command)).resolves.toStrictEqual([eventCreate]);
  }, 10000);

  test("should throw on causation missing events", async () => {
    const entity = new Aggregate({ ...aggregate, eventHandlers }, logger);
    const command = new Command({ ...TEST_COMMAND_CREATE, aggregate });

    await entity.apply(command, "domain_event_create", { created: true });

    await expect(store.save(entity, new Command({ ...TEST_COMMAND, aggregate }))).rejects.toThrow(
      CausationMissingEventsError,
    );
  }, 10000);

  test("should load existing aggregate", async () => {
    const eventCreate = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });
    const eventMergeState = new DomainEvent({ ...TEST_DOMAIN_EVENT_MERGE_STATE, aggregate });
    const eventSetState = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });
    const eventDestroy = new DomainEvent({ ...TEST_DOMAIN_EVENT_DESTROY, aggregate });

    toArray.mockResolvedValue([
      { events: [eventCreate] },
      { events: [eventMergeState] },
      { events: [eventSetState] },
      { events: [eventDestroy] },
    ]);

    await expect(store.load(aggregate, eventHandlers)).resolves.toStrictEqual(
      expect.objectContaining({
        id: aggregate.id,
        name: "aggregate_name",
        context: "default",
        destroyed: true,
        events: [
          expect.objectContaining({
            name: "domain_event_create",
          }),
          expect.objectContaining({
            name: "domain_event_merge_state",
          }),
          expect.objectContaining({
            name: "domain_event_set_state",
          }),
          expect.objectContaining({
            name: "domain_event_destroy",
          }),
        ],
        numberOfLoadedEvents: 4,
        state: {
          created: true,
          merge: { domainEventData: true },
          path: {
            value: { domainEventData: true },
          },
        },
      }),
    );
  }, 10000);

  test("should load new aggregate", async () => {
    await expect(store.load(aggregate, eventHandlers)).resolves.toStrictEqual(
      expect.objectContaining({
        id: aggregate.id,
        name: "aggregate_name",
        context: "default",
        destroyed: false,
        events: [],
        numberOfLoadedEvents: 0,
        state: {},
      }),
    );
  }, 10000);
});
