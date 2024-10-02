import { createMockAesKit } from "@lindorm/aes";
import { LindormError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
import { createMockRabbitMessageBus } from "@lindorm/rabbit";
import { randomUUID } from "crypto";
import { TEST_AGGREGATE_IDENTIFIER } from "../__fixtures__/aggregate";
import {
  TEST_AGGREGATE_COMMAND_HANDLER,
  TEST_AGGREGATE_COMMAND_HANDLER_CREATE,
  TEST_AGGREGATE_COMMAND_HANDLER_DESTROY,
  TEST_AGGREGATE_COMMAND_HANDLER_DESTROY_NEXT,
  TEST_AGGREGATE_COMMAND_HANDLER_ENCRYPT,
  TEST_AGGREGATE_COMMAND_HANDLER_MERGE_STATE,
  TEST_AGGREGATE_COMMAND_HANDLER_SET_STATE,
  TEST_AGGREGATE_COMMAND_HANDLER_THROWS,
} from "../__fixtures__/aggregate-command-handler";
import {
  TEST_AGGREGATE_EVENT_HANDLER,
  TEST_AGGREGATE_EVENT_HANDLER_CREATE,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY,
  TEST_AGGREGATE_EVENT_HANDLER_DESTROY_NEXT,
  TEST_AGGREGATE_EVENT_HANDLER_ENCRYPT,
  TEST_AGGREGATE_EVENT_HANDLER_MERGE_STATE,
  TEST_AGGREGATE_EVENT_HANDLER_SET_STATE,
  TEST_AGGREGATE_EVENT_HANDLER_THROWS,
} from "../__fixtures__/aggregate-event-handler";
import {
  TEST_HERMES_COMMAND_CREATE,
  TEST_HERMES_COMMAND_ENCRYPT,
  TEST_HERMES_COMMAND_MERGE_STATE,
  TEST_HERMES_COMMAND_THROWS,
} from "../__fixtures__/hermes-command";
import {
  AggregateAlreadyCreatedError,
  AggregateDestroyedError,
  AggregateNotCreatedError,
  HandlerNotRegisteredError,
} from "../errors";
import { IAggregateDomain, IHermesMessageBus } from "../interfaces";
import { HermesCommand } from "../messages";
import { AggregateDomain } from "./AggregateDomain";

describe("AggregateDomain", () => {
  const logger = createMockLogger();
  const commandHandlers = [
    TEST_AGGREGATE_COMMAND_HANDLER,
    TEST_AGGREGATE_COMMAND_HANDLER_CREATE,
    TEST_AGGREGATE_COMMAND_HANDLER_DESTROY,
    TEST_AGGREGATE_COMMAND_HANDLER_DESTROY_NEXT,
    TEST_AGGREGATE_COMMAND_HANDLER_ENCRYPT,
    TEST_AGGREGATE_COMMAND_HANDLER_MERGE_STATE,
    TEST_AGGREGATE_COMMAND_HANDLER_SET_STATE,
    TEST_AGGREGATE_COMMAND_HANDLER_THROWS,
  ];
  const eventHandlers = [
    TEST_AGGREGATE_EVENT_HANDLER,
    TEST_AGGREGATE_EVENT_HANDLER_CREATE,
    TEST_AGGREGATE_EVENT_HANDLER_DESTROY,
    TEST_AGGREGATE_EVENT_HANDLER_DESTROY_NEXT,
    TEST_AGGREGATE_EVENT_HANDLER_ENCRYPT,
    TEST_AGGREGATE_EVENT_HANDLER_MERGE_STATE,
    TEST_AGGREGATE_EVENT_HANDLER_SET_STATE,
    TEST_AGGREGATE_EVENT_HANDLER_THROWS,
  ];

  let domain: IAggregateDomain;
  let messageBus: IHermesMessageBus;
  let encryptionStore: any;
  let eventStore: any;

  beforeEach(async () => {
    messageBus = createMockRabbitMessageBus(HermesCommand);
    eventStore = {
      find: jest.fn().mockImplementation(async () => []),
      insert: jest.fn().mockImplementation(async () => {}),
    };
    encryptionStore = {
      load: jest.fn().mockImplementation(async () => createMockAesKit()),
    };
    domain = new AggregateDomain({ messageBus, encryptionStore, eventStore, logger });

    for (const handler of commandHandlers) {
      await domain.registerCommandHandler(handler);
    }

    for (const handler of eventHandlers) {
      await domain.registerEventHandler(handler);
    }
  });

  test("should register command handler", async () => {
    messageBus = createMockRabbitMessageBus(HermesCommand);
    domain = new AggregateDomain({ messageBus, encryptionStore, eventStore, logger });

    await expect(
      domain.registerCommandHandler(TEST_AGGREGATE_COMMAND_HANDLER),
    ).resolves.toBeUndefined();

    expect(messageBus.subscribe).toHaveBeenCalledWith({
      callback: expect.any(Function),
      queue: "queue.aggregate.default.aggregate_name.hermes_command_default",
      topic: "default.aggregate_name.hermes_command_default",
    });
  });

  test("should throw on existing command handler", async () => {
    domain = new AggregateDomain({ messageBus, encryptionStore, eventStore, logger });

    await domain.registerCommandHandler(TEST_AGGREGATE_COMMAND_HANDLER);

    await expect(
      domain.registerCommandHandler(TEST_AGGREGATE_COMMAND_HANDLER),
    ).rejects.toThrow(LindormError);
  });

  test("should throw on invalid command handler", async () => {
    domain = new AggregateDomain({ messageBus, encryptionStore, eventStore, logger });

    await expect(
      // @ts-expect-error
      domain.registerCommandHandler(TEST_AGGREGATE_EVENT_HANDLER),
    ).rejects.toThrow(LindormError);
  });

  test("should register event handler", async () => {
    domain = new AggregateDomain({ messageBus, encryptionStore, eventStore, logger });

    await expect(
      domain.registerEventHandler(TEST_AGGREGATE_EVENT_HANDLER),
    ).resolves.toBeUndefined();
  });

  test("should throw on existing event handler", async () => {
    domain = new AggregateDomain({ messageBus, encryptionStore, eventStore, logger });

    await domain.registerEventHandler(TEST_AGGREGATE_EVENT_HANDLER);

    await expect(
      domain.registerEventHandler(TEST_AGGREGATE_EVENT_HANDLER),
    ).rejects.toThrow(LindormError);
  });

  test("should throw on invalid event handler", async () => {
    domain = new AggregateDomain({ messageBus, encryptionStore, eventStore, logger });

    await expect(
      // @ts-expect-error
      domain.registerEventHandler(TEST_AGGREGATE_COMMAND_HANDLER),
    ).rejects.toThrow(LindormError);
  });

  test("should handle command", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const command = new HermesCommand({ ...TEST_HERMES_COMMAND_CREATE, aggregate });

    await expect(
      // @ts-expect-error
      domain.handleCommand(command),
    ).resolves.toBeUndefined();

    expect(eventStore.find).toHaveBeenCalled();

    expect(TEST_AGGREGATE_COMMAND_HANDLER_CREATE.handler).toHaveBeenCalledTimes(1);

    expect(eventStore.insert).toHaveBeenCalledWith([
      {
        aggregate_id: expect.any(String),
        aggregate_name: "aggregate_name",
        aggregate_context: "default",
        causation_id: expect.any(String),
        checksum: expect.any(String),
        correlation_id: expect.any(String),
        data: { dataFromCommand: { commandData: true } },
        encrypted: false,
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

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        id: expect.any(String),
        name: "hermes_event_create",
        aggregate,
        causationId: command.id,
        correlationId: command.correlationId,
        data: { dataFromCommand: { commandData: true } },
        meta: { origin: "test" },
        delay: 0,
        mandatory: false,
        topic: "default.aggregate_name.hermes_event_create",
        timestamp: expect.any(Date),
        type: "HermesEvent",
        version: 1,
      }),
    ]);
  });

  test("should handle encryption command", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const command = new HermesCommand({ ...TEST_HERMES_COMMAND_ENCRYPT, aggregate });

    await expect(
      // @ts-expect-error
      domain.handleCommand(command),
    ).resolves.toBeUndefined();

    expect(eventStore.find).toHaveBeenCalled();

    expect(TEST_AGGREGATE_COMMAND_HANDLER_ENCRYPT.handler).toHaveBeenCalledTimes(1);

    expect(eventStore.insert).toHaveBeenCalledWith([
      {
        aggregate_id: expect.any(String),
        aggregate_name: "aggregate_name",
        aggregate_context: "default",
        causation_id: expect.any(String),
        checksum: expect.any(String),
        correlation_id: expect.any(String),
        data: {
          content:
            "eyJfX21ldGFfXyI6eyJlbmNyeXB0ZWREYXRhIjp7ImNvbW1hbmREYXRhIjoiQiJ9fSwiX19yZWNvcmRfXyI6eyJlbmNyeXB0ZWREYXRhIjp7ImNvbW1hbmREYXRhIjoidHJ1ZSJ9fX0=",
        },
        encrypted: true,
        event_id: expect.any(String),
        event_name: "hermes_event_encrypt",
        event_timestamp: expect.any(Date),
        expected_events: 0,
        meta: { origin: "test" },
        previous_event_id: null,
        timestamp: expect.any(Date),
        version: 1,
      },
    ]);

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        id: expect.any(String),
        name: "hermes_event_encrypt",
        aggregate,
        causationId: command.id,
        correlationId: command.correlationId,
        data: { encryptedData: { commandData: true } },
        meta: { origin: "test" },
        delay: 0,
        mandatory: false,
        topic: "default.aggregate_name.hermes_event_encrypt",
        timestamp: expect.any(Date),
        type: "HermesEvent",
        version: 1,
      }),
    ]);
  });

  test("should skip handler when last causation matches command id", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID(), logger };

    const command = new HermesCommand({
      ...TEST_HERMES_COMMAND_MERGE_STATE,
      aggregate,
      id: "e6abb357-57da-564e-a7f6-6ff665db7834",
    });

    eventStore.find.mockImplementation(async () => [
      {
        aggregate_id: aggregate.id,
        aggregate_name: aggregate.name,
        aggregate_context: aggregate.context,
        causation_id: randomUUID(),
        checksum: "checksum",
        correlation_id: randomUUID(),
        data: { create: true },
        encrypted: false,
        event_id: "000f86fe-b2b7-5586-b0fb-f9bbf91ad771",
        event_name: "hermes_event_create",
        event_timestamp: new Date(),
        expected_events: 0,
        meta: {},
        previous_event_id: null,
        timestamp: new Date(),
        version: 1,
      },
      {
        aggregate_id: aggregate.id,
        aggregate_name: aggregate.name,
        aggregate_context: aggregate.context,
        causation_id: "e6abb357-57da-564e-a7f6-6ff665db7834",
        checksum: "checksum",
        correlation_id: randomUUID(),
        data: { merge: true },
        encrypted: false,
        event_id: randomUUID(),
        event_name: "hermes_event_merge_state",
        event_timestamp: new Date(),
        expected_events: 1,
        meta: {},
        previous_event_id: "000f86fe-b2b7-5586-b0fb-f9bbf91ad771",
        timestamp: new Date(),
        version: 1,
      },
    ]);

    await expect(
      // @ts-expect-error
      domain.handleCommand(command),
    ).resolves.toBeUndefined();

    expect(TEST_AGGREGATE_COMMAND_HANDLER_MERGE_STATE.handler).not.toHaveBeenCalled();
  });

  test("should throw on missing command handler", async () => {
    domain = new AggregateDomain({ messageBus, encryptionStore, eventStore, logger });
    const command = new HermesCommand(TEST_HERMES_COMMAND_CREATE);

    await expect(
      // @ts-expect-error
      domain.handleCommand(command),
    ).rejects.toThrow(HandlerNotRegisteredError);
  });

  test("should throw on invalid command data", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const command = new HermesCommand({
      ...TEST_HERMES_COMMAND_CREATE,
      aggregate,
      data: {},
    });

    await expect(
      // @ts-expect-error
      domain.handleCommand(command),
    ).rejects.toThrow(Error);

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "command_schema_validation_error",
        data: {
          error: expect.any(Error),
          message: command,
        },
      }),
    ]);
  });

  test("should throw on destroyed aggregate", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const command = new HermesCommand({ ...TEST_HERMES_COMMAND_CREATE, aggregate });

    eventStore.find.mockImplementation(async () => [
      {
        aggregate_id: aggregate.id,
        aggregate_name: aggregate.name,
        aggregate_context: aggregate.context,
        causation_id: randomUUID(),
        checksum: "checksum",
        correlation_id: randomUUID(),
        data: {},
        encrypted: false,
        event_id: randomUUID(),
        event_name: "hermes_event_destroy",
        event_timestamp: new Date(),
        expected_events: 0,
        meta: {},
        previous_event_id: null,
        timestamp: new Date(),
        version: 1,
      },
    ]);

    await expect(
      // @ts-expect-error
      domain.handleCommand(command),
    ).rejects.toThrow(AggregateDestroyedError);

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "aggregate_destroyed_error",
        data: {
          error: expect.any(AggregateDestroyedError),
          message: command,
        },
      }),
    ]);
  });

  test("should throw on not created aggregate", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const command = new HermesCommand({ ...TEST_HERMES_COMMAND_MERGE_STATE, aggregate });

    await expect(
      // @ts-expect-error
      domain.handleCommand(command),
    ).rejects.toThrow(AggregateNotCreatedError);

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "aggregate_not_created_error",
        data: {
          error: expect.any(AggregateNotCreatedError),
          message: command,
        },
      }),
    ]);
  });

  test("should throw on already created aggregate", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const command = new HermesCommand({ ...TEST_HERMES_COMMAND_CREATE, aggregate });

    eventStore.find.mockImplementation(async () => [
      {
        aggregate_id: aggregate.id,
        aggregate_name: aggregate.name,
        aggregate_context: aggregate.context,
        causation_id: randomUUID(),
        checksum: "checksum",
        correlation_id: randomUUID(),
        data: { create: true },
        encrypted: false,
        event_id: randomUUID(),
        event_name: "hermes_event_create",
        event_timestamp: new Date(),
        expected_events: 0,
        meta: {},
        previous_event_id: null,
        timestamp: new Date(),
        version: 1,
      },
    ]);

    await expect(
      // @ts-expect-error
      domain.handleCommand(command),
    ).rejects.toThrow(AggregateAlreadyCreatedError);

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "aggregate_already_created_error",
        data: {
          error: expect.any(AggregateAlreadyCreatedError),
          message: command,
        },
      }),
    ]);
  });

  test("should throw from command handler", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const command = new HermesCommand({ ...TEST_HERMES_COMMAND_THROWS, aggregate });

    eventStore.find.mockImplementation(async () => [
      {
        aggregate_id: aggregate.id,
        aggregate_name: aggregate.name,
        aggregate_context: aggregate.context,
        causation_id: randomUUID(),
        checksum: "checksum",
        correlation_id: randomUUID(),
        data: { create: true },
        encrypted: false,
        event_id: randomUUID(),
        event_name: "hermes_event_create",
        event_timestamp: new Date(),
        expected_events: 0,
        meta: {},
        previous_event_id: null,
        timestamp: new Date(),
        version: 1,
      },
    ]);

    await expect(
      // @ts-expect-error
      domain.handleCommand(command),
    ).rejects.toThrow(new Error("throw"));
  });
});
