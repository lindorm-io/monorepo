import { createMockLogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import { TEST_AGGREGATE_IDENTIFIER } from "../__fixtures__/aggregate";
import {
  TEST_AGGREGATE_EVENT_HANDLER,
  TEST_AGGREGATE_EVENT_HANDLER_CREATE,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY_NEXT,
  TEST_AGGREGATE_EVENT_HANDLER_MERGE_STATE,
  TEST_AGGREGATE_EVENT_HANDLER_SET_STATE,
  TEST_AGGREGATE_EVENT_HANDLER_THROWS,
} from "../__fixtures__/aggregate-event-handler";
import {
  TEST_HERMES_COMMAND,
  TEST_HERMES_COMMAND_CREATE,
  TEST_HERMES_COMMAND_MERGE_STATE,
} from "../__fixtures__/hermes-command";
import { TEST_HERMES_EVENT_CREATE } from "../__fixtures__/hermes-event";
import { CausationMissingEventsError } from "../errors";
import { HermesCommand, HermesEvent } from "../messages";
import { Aggregate } from "../models";
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

    store = new EventStore({
      custom: mock,
      logger,
    });
  }, 10000);

  beforeEach(() => {
    identifier = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should save new aggregate", async () => {
    class HermesEventCreate {
      public constructor(public readonly create: boolean) {}
    }

    const aggregate = new Aggregate({ ...identifier, eventHandlers, logger });
    const command = new HermesCommand({
      ...TEST_HERMES_COMMAND_CREATE,
      aggregate: identifier,
    });
    await aggregate.apply(command, new HermesEventCreate(true));

    mock.find.mockResolvedValue([]);

    await expect(store.save(aggregate, command)).resolves.toEqual([
      expect.objectContaining({
        name: "hermes_event_create",
        causationId: command.id,
        correlationId: command.correlationId,
        data: { create: true },
        timestamp: expect.any(Date),
        version: 1,
      }),
    ]);

    expect(mock.insert).toHaveBeenCalledWith([
      {
        aggregate_id: aggregate.id,
        aggregate_name: "aggregate_name",
        aggregate_context: "default",
        causation_id: command.id,
        checksum: expect.any(String),
        correlation_id: command.correlationId,
        data: { create: true },
        event_id: expect.any(String),
        event_name: "hermes_event_create",
        event_timestamp: expect.any(Date),
        expected_events: 0,
        meta: { origin: "test" },
        previous_event_id: null,
        timestamp: expect.any(Date),
        version: 1,
      },
    ]);
  });

  test("should save existing aggregate", async () => {
    class HermesEventMergeState {
      public constructor(public readonly merge: boolean) {}
    }

    const aggregate = new Aggregate({ ...identifier, eventHandlers, logger });
    const event = new HermesEvent({ ...TEST_HERMES_EVENT_CREATE, aggregate: identifier });
    await aggregate.load(event);

    const command = new HermesCommand({
      ...TEST_HERMES_COMMAND_MERGE_STATE,
      aggregate: identifier,
    });
    await aggregate.apply(command, new HermesEventMergeState(true));

    mock.find.mockResolvedValue([]);

    await expect(store.save(aggregate, command)).resolves.toEqual([
      expect.objectContaining({
        name: "hermes_event_merge_state",
        correlationId: command.correlationId,
        data: { merge: true },
        timestamp: expect.any(Date),
        version: 1,
      }),
    ]);

    expect(mock.insert).toHaveBeenCalledWith([
      {
        aggregate_id: aggregate.id,
        aggregate_name: "aggregate_name",
        aggregate_context: "default",
        causation_id: command.id,
        checksum: expect.any(String),
        correlation_id: command.correlationId,
        data: { merge: true },
        event_id: expect.any(String),
        event_name: "hermes_event_merge_state",
        event_timestamp: expect.any(Date),
        expected_events: 1,
        meta: { origin: "test" },
        previous_event_id: event.id,
        timestamp: expect.any(Date),
        version: 1,
      },
    ]);
  });

  test("should load new aggregate", async () => {
    mock.find.mockResolvedValue([]);

    await expect(store.load(identifier, eventHandlers)).resolves.toEqual(
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
        aggregate_id: filter.id,
        aggregate_name: filter.name,
        aggregate_context: filter.context,
        causation_id: filter.causation_id || "6de42a0d-1506-43df-b49b-aa2cdbc34fda",
        correlation_id: "cd89bb36-5369-4b26-a4cf-b67f5849e3fb",
        data: { event_data: "data" },
        event_id: "4f4723d5-5816-4fca-8b0c-86f82b79f16d",
        event_name: "hermes_event_create",
        timestamp: new Date("2022-01-01T08:00:00.000Z"),
        version: 1,
      },
    ]);

    await expect(store.load(identifier, eventHandlers)).resolves.toEqual(
      expect.objectContaining({
        id: identifier.id,
        name: "aggregate_name",
        context: "default",
        destroyed: false,
        events: [
          expect.objectContaining({
            id: "4f4723d5-5816-4fca-8b0c-86f82b79f16d",
            name: "hermes_event_create",
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
            meta: {},
            delay: 0,
            mandatory: false,
            timestamp: expect.any(Date),
            type: "HermesEvent",
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
    class HermesEventCreate {
      public constructor(public readonly create: boolean) {}
    }

    const aggregate = new Aggregate({ ...identifier, eventHandlers, logger });
    const command = new HermesCommand({
      ...TEST_HERMES_COMMAND_CREATE,
      aggregate: identifier,
    });
    await aggregate.apply(command, new HermesEventCreate(true));

    const testCommand = new HermesCommand({
      ...TEST_HERMES_COMMAND,
      aggregate: identifier,
    });

    mock.find.mockResolvedValue([]);

    await expect(store.save(aggregate, testCommand)).rejects.toThrow(
      CausationMissingEventsError,
    );
  });

  test("should list all events", async () => {
    mock.listEvents.mockImplementation(async (from: Date, limit: number) => [
      {
        aggregate_id: "1816e87a-f560-423f-9caa-7752ff4f6cbd",
        aggregate_name: "aggregate_name",
        aggregate_context: "aggregate_context",
        causation_id: "6de42a0d-1506-43df-b49b-aa2cdbc34fda",
        correlation_id: "cd89bb36-5369-4b26-a4cf-b67f5849e3fb",
        data: { event_data: "data" },
        event_id: "4f4723d5-5816-4fca-8b0c-86f82b79f16d",
        event_name: "event_name",
        meta: { meta_data: "data" },
        timestamp: new Date("2022-01-01T08:00:00.000Z"),
        version: 1,
      },
    ]);

    await expect(store.listEvents(new Date(), 100)).resolves.toEqual([
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
        meta: { meta_data: "data" },
        delay: 0,
        mandatory: false,
        timestamp: expect.any(Date),
        type: "HermesEvent",
        version: 1,
      }),
    ]);
  });
});
