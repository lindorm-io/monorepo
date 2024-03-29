import { createMockLogger } from "@lindorm-io/core-logger";
import { randomUUID } from "crypto";
import { EventStoreType } from "../enum";
import { CausationMissingEventsError } from "../error";
import {
  TEST_AGGREGATE_EVENT_HANDLER,
  TEST_AGGREGATE_EVENT_HANDLER_CREATE,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY_NEXT,
  TEST_AGGREGATE_EVENT_HANDLER_MERGE_STATE,
  TEST_AGGREGATE_EVENT_HANDLER_SET_STATE,
  TEST_AGGREGATE_EVENT_HANDLER_THROWS,
} from "../fixtures/aggregate-event-handler.fixture";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import {
  TEST_COMMAND,
  TEST_COMMAND_CREATE,
  TEST_COMMAND_MERGE_STATE,
} from "../fixtures/command.fixture";
import { TEST_DOMAIN_EVENT_CREATE } from "../fixtures/domain-event.fixture";
import { Command, DomainEvent } from "../message";
import { Aggregate } from "../model";
import { AggregateIdentifier } from "../types";
import { EventStore } from "./EventStore";

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

  let mock: any;
  let identifier: AggregateIdentifier;
  let store: EventStore;

  beforeAll(async () => {
    mock = {
      find: jest.fn(),
      insert: jest.fn().mockResolvedValue(undefined),
      listEvents: jest.fn(),
    };

    store = new EventStore(
      {
        type: EventStoreType.CUSTOM,
        custom: mock,
      },
      logger,
    );
  }, 10000);

  beforeEach(() => {
    identifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should save new aggregate", async () => {
    class DomainEventCreate {
      public constructor(public readonly create: boolean) {}
    }

    const aggregate = new Aggregate({ ...identifier, eventHandlers }, logger);
    const command = new Command({ ...TEST_COMMAND_CREATE, aggregate: identifier });
    await aggregate.apply(command, new DomainEventCreate(true));

    mock.find.mockResolvedValue([]);

    await expect(store.save(aggregate, command)).resolves.toStrictEqual([
      expect.objectContaining({
        name: "domain_event_create",
        causationId: command.id,
        correlationId: command.correlationId,
        data: { create: true },
        timestamp: expect.any(Date),
        version: 1,
      }),
    ]);

    expect(mock.insert).toHaveBeenCalledWith({
      id: aggregate.id,
      name: "aggregate_name",
      context: "default",
      causation_id: command.id,
      checksum: expect.any(String),
      correlation_id: command.correlationId,
      events: [
        {
          id: expect.any(String),
          name: "domain_event_create",
          data: {
            create: true,
          },
          meta: {
            origin: "test",
          },
          timestamp: expect.any(Date),
          version: 1,
        },
      ],
      expected_events: 0,
      previous_event_id: null,
      timestamp: expect.any(Date),
    });
  });

  test("should save existing aggregate", async () => {
    class DomainEventMergeState {
      public constructor(public readonly merge: boolean) {}
    }

    const aggregate = new Aggregate({ ...identifier, eventHandlers }, logger);
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate: identifier });
    await aggregate.load(event);

    const command = new Command({ ...TEST_COMMAND_MERGE_STATE, aggregate: identifier });
    await aggregate.apply(command, new DomainEventMergeState(true));

    mock.find.mockResolvedValue([]);

    await expect(store.save(aggregate, command)).resolves.toStrictEqual([
      expect.objectContaining({
        name: "domain_event_merge_state",
        correlationId: command.correlationId,
        data: { merge: true },
        timestamp: expect.any(Date),
        version: 1,
      }),
    ]);

    expect(mock.insert).toHaveBeenCalledWith({
      id: aggregate.id,
      name: "aggregate_name",
      context: "default",
      causation_id: command.id,
      checksum: expect.any(String),
      correlation_id: command.correlationId,
      events: [
        {
          id: expect.any(String),
          name: "domain_event_merge_state",
          data: {
            merge: true,
          },
          meta: {
            origin: "test",
          },
          timestamp: expect.any(Date),
          version: 1,
        },
      ],
      expected_events: 1,
      previous_event_id: event.id,
      timestamp: expect.any(Date),
    });
  });

  test("should load new aggregate", async () => {
    mock.find.mockResolvedValue([]);

    await expect(store.load(identifier, eventHandlers)).resolves.toStrictEqual(
      expect.objectContaining({
        id: identifier.id,
        name: "aggregate_name",
        context: "default",
        destroyed: false,
        events: [],
        numberOfLoadedEvents: 0,
        state: {},
      }),
    );
  });

  test("should load existing aggregate", async () => {
    mock.find.mockImplementation(async (filter: any) => [
      {
        id: "4f4723d5-5816-4fca-8b0c-86f82b79f16d",
        name: "domain_event_create",
        aggregate: {
          id: filter.id,
          name: filter.name,
          context: filter.context,
        },
        causation_id: filter.causation_id || "6de42a0d-1506-43df-b49b-aa2cdbc34fda",
        correlation_id: "cd89bb36-5369-4b26-a4cf-b67f5849e3fb",
        data: { event_data: "data" },
        timestamp: new Date("2022-01-01T08:00:00.000Z"),
        version: 1,
      },
    ]);

    await expect(store.load(identifier, eventHandlers)).resolves.toStrictEqual(
      expect.objectContaining({
        id: identifier.id,
        name: "aggregate_name",
        context: "default",
        destroyed: false,
        events: [
          expect.objectContaining({
            id: "4f4723d5-5816-4fca-8b0c-86f82b79f16d",
            name: "domain_event_create",
            aggregate: {
              id: identifier.id,
              name: "aggregate_name",
              context: "default",
            },
            causationId: "6de42a0d-1506-43df-b49b-aa2cdbc34fda",
            correlationId: "cd89bb36-5369-4b26-a4cf-b67f5849e3fb",
            data: {
              event_data: "data",
            },
            metadata: {},
            delay: 0,
            mandatory: false,
            timestamp: expect.any(Date),
            type: "domain_event",
            version: 1,
          }),
        ],
        numberOfLoadedEvents: 1,
        state: {
          created: true,
        },
      }),
    );
  });

  test("should throw on causation missing events", async () => {
    class DomainEventCreate {
      public constructor(public readonly create: boolean) {}
    }

    const aggregate = new Aggregate({ ...identifier, eventHandlers }, logger);
    const command = new Command({ ...TEST_COMMAND_CREATE, aggregate: identifier });
    await aggregate.apply(command, new DomainEventCreate(true));

    const testCommand = new Command({ ...TEST_COMMAND, aggregate: identifier });

    mock.find.mockResolvedValue([]);

    await expect(store.save(aggregate, testCommand)).rejects.toThrow(CausationMissingEventsError);
  });

  test("should list all events", async () => {
    mock.listEvents.mockImplementation(async (from: Date, limit: number) => [
      {
        id: "4f4723d5-5816-4fca-8b0c-86f82b79f16d",
        name: "event_name",
        aggregate: {
          id: "1816e87a-f560-423f-9caa-7752ff4f6cbd",
          name: "aggregate_name",
          context: "aggregate_context",
        },
        causation_id: "6de42a0d-1506-43df-b49b-aa2cdbc34fda",
        correlation_id: "cd89bb36-5369-4b26-a4cf-b67f5849e3fb",
        data: { event_data: "data" },
        meta: { meta_data: "data" },
        timestamp: new Date("2022-01-01T08:00:00.000Z"),
        version: 1,
      },
    ]);

    await expect(store.listEvents(new Date(), 100)).resolves.toStrictEqual([
      expect.objectContaining({
        id: "4f4723d5-5816-4fca-8b0c-86f82b79f16d",
        name: "event_name",
        aggregate: {
          id: "1816e87a-f560-423f-9caa-7752ff4f6cbd",
          name: "aggregate_name",
          context: "aggregate_context",
        },
        causationId: "6de42a0d-1506-43df-b49b-aa2cdbc34fda",
        correlationId: "cd89bb36-5369-4b26-a4cf-b67f5849e3fb",
        data: { event_data: "data" },
        metadata: { meta_data: "data" },
        delay: 0,
        mandatory: false,
        timestamp: expect.any(Date),
        type: "domain_event",
        version: 1,
      }),
    ]);
  });
});
