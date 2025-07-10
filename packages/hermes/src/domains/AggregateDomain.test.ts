import { createMockAesKit } from "@lindorm/aes";
import { createMockLogger } from "@lindorm/logger";
import { createMockRabbitMessageBus } from "@lindorm/rabbit";
import { Dict } from "@lindorm/types";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import { createTestCommand } from "../__fixtures__/create-message";
import { createTestAggregateIdentifier } from "../__fixtures__/create-test-aggregate-identifier";
import { createTestRegistry } from "../__fixtures__/create-test-registry";
import { TestCommandCreate } from "../__fixtures__/modules/commands/TestCommandCreate";
import { TestCommandDestroy } from "../__fixtures__/modules/commands/TestCommandDestroy";
import { TestCommandEncrypt } from "../__fixtures__/modules/commands/TestCommandEncrypt";
import { TestCommandMergeState } from "../__fixtures__/modules/commands/TestCommandMergeState";
import { TestCommandThrows } from "../__fixtures__/modules/commands/TestCommandThrows";
import {
  AggregateAlreadyCreatedError,
  AggregateDestroyedError,
  AggregateNotCreatedError,
} from "../errors";
import { IAggregateDomain, IHermesMessageBus } from "../interfaces";
import { HermesCommand, HermesError, HermesEvent } from "../messages";
import { AggregateDomain } from "./AggregateDomain";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("AggregateDomain", () => {
  const logger = createMockLogger();

  let domain: IAggregateDomain;
  let commandBus: IHermesMessageBus<HermesCommand<Dict>>;
  let errorBus: IHermesMessageBus<HermesError>;
  let eventBus: IHermesMessageBus<HermesEvent<Dict>>;
  let encryptionStore: any;
  let eventStore: any;

  beforeEach(async () => {
    commandBus = createMockRabbitMessageBus(HermesCommand);
    errorBus = createMockRabbitMessageBus(HermesError);
    eventBus = createMockRabbitMessageBus(HermesEvent);

    eventStore = {
      find: jest.fn().mockImplementation(async () => []),
      insert: jest.fn().mockImplementation(async () => {}),
    };
    encryptionStore = {
      load: jest.fn().mockImplementation(async () => createMockAesKit()),
    };

    domain = new AggregateDomain({
      commandBus,
      encryptionStore,
      errorBus,
      eventBus,
      eventStore,
      logger,
      registry: createTestRegistry(),
    });

    await domain.registerHandlers();
  });

  test("should register command handler", async () => {
    expect(commandBus.subscribe).toHaveBeenCalledWith({
      callback: expect.any(Function),
      queue: "queue.aggregate.hermes.test_aggregate.test_command_create",
      topic: "hermes.test_aggregate.test_command_create",
    });
  });

  test("should handle command", async () => {
    const aggregate = createTestAggregateIdentifier();
    const command = createTestCommand(new TestCommandCreate("create"), { aggregate });

    await expect(
      // @ts-expect-error
      domain.handleCommand(command),
    ).resolves.toBeUndefined();

    expect(eventStore.find).toHaveBeenCalled();

    expect(eventStore.insert).toHaveBeenCalledWith([
      {
        aggregate_id: expect.any(String),
        aggregate_name: "test_aggregate",
        aggregate_context: "hermes",
        causation_id: expect.any(String),
        checksum: expect.any(String),
        correlation_id: expect.any(String),
        data: { input: "create" },
        encrypted: false,
        event_id: expect.any(String),
        event_name: "test_event_create",
        event_timestamp: MockedDate,
        expected_events: 0,
        meta: { origin: "test" },
        previous_event_id: null,
        version: 1,
        created_at: MockedDate,
      },
    ]);

    expect(eventBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        id: expect.any(String),
        name: "test_event_create",
        aggregate,
        causationId: command.id,
        correlationId: command.correlationId,
        data: { input: "create" },
        meta: { origin: "test" },
        delay: 0,
        mandatory: false,
        timestamp: MockedDate,
        version: 1,
      }),
    ]);
  });

  test("should handle encryption command", async () => {
    const aggregate = createTestAggregateIdentifier();
    const command = createTestCommand(new TestCommandEncrypt("encrypt"), { aggregate });

    await expect(
      // @ts-expect-error
      domain.handleCommand(command),
    ).resolves.toBeUndefined();

    expect(eventStore.find).toHaveBeenCalled();

    expect(eventStore.insert).toHaveBeenCalledWith([
      {
        aggregate_id: expect.any(String),
        aggregate_name: "test_aggregate",
        aggregate_context: "hermes",
        causation_id: expect.any(String),
        checksum: expect.any(String),
        correlation_id: expect.any(String),
        data: {
          content:
            "eyJfX21ldGFfXyI6eyJpbnB1dCI6IlMifSwiX19yZWNvcmRfXyI6eyJpbnB1dCI6ImVuY3J5cHQifX0=",
        },
        encrypted: true,
        event_id: expect.any(String),
        event_name: "test_event_encrypt",
        event_timestamp: MockedDate,
        expected_events: 0,
        meta: { origin: "test" },
        previous_event_id: null,
        version: 1,
        created_at: MockedDate,
      },
    ]);

    expect(eventBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        id: expect.any(String),
        name: "test_event_encrypt",
        aggregate,
        causationId: command.id,
        correlationId: command.correlationId,
        data: { input: "encrypt" },
        meta: { origin: "test" },
        delay: 0,
        mandatory: false,
        timestamp: MockedDate,
        version: 1,
      }),
    ]);
  });

  test("should skip handler when last causation matches command id", async () => {
    const aggregate = { ...createTestAggregateIdentifier(), id: randomUUID(), logger };

    const command = createTestCommand(new TestCommandMergeState("merge-state"), {
      id: "e6abb357-57da-564e-a7f6-6ff665db7834",
      aggregate,
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
        event_name: "test_event_create",
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
        event_name: "test_event_merge_state",
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
  });

  test("should throw on invalid command data", async () => {
    const aggregate = createTestAggregateIdentifier();
    const command = createTestCommand(new TestCommandCreate("create"), {
      aggregate,
      data: {},
    });

    await expect(
      // @ts-expect-error
      domain.handleCommand(command),
    ).rejects.toThrow(Error);

    expect(errorBus.publish).toHaveBeenCalledWith({
      id: expect.any(String),
      aggregate: {
        id: expect.any(String),
        name: "test_aggregate",
        context: "hermes",
      },
      causationId: expect.any(String),
      correlationId: expect.any(String),
      data: {
        command: expect.objectContaining({
          input: undefined,
        }),
        error: expect.objectContaining({ name: "CommandSchemaValidationError" }),
        message: command,
      },
      delay: 0,
      mandatory: true,
      meta: {
        origin: "test",
      },
      name: "command_schema_validation_error",
      timestamp: expect.any(Date),
      version: 1,
    });
  });

  test("should throw on destroyed aggregate", async () => {
    const aggregate = createTestAggregateIdentifier();
    const command = createTestCommand(new TestCommandCreate("create"), { aggregate });

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
        event_name: "test_event_destroy",
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

    expect(errorBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "aggregate_destroyed_error",
        data: {
          command: expect.objectContaining({
            input: "create",
          }),
          error: expect.objectContaining({ name: "AggregateDestroyedError" }),
          message: command,
        },
      }),
    );
  });

  test("should throw on not created aggregate", async () => {
    const aggregate = createTestAggregateIdentifier();
    const command = createTestCommand(new TestCommandDestroy("merge-state"), {
      aggregate,
    });

    await expect(
      // @ts-expect-error
      domain.handleCommand(command),
    ).rejects.toThrow(AggregateNotCreatedError);

    expect(errorBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "aggregate_not_created_error",
        data: {
          command: expect.objectContaining({
            input: "merge-state",
          }),
          error: expect.objectContaining({ name: "AggregateNotCreatedError" }),
          message: command,
        },
      }),
    );
  });

  test("should throw on already created aggregate", async () => {
    const aggregate = createTestAggregateIdentifier();
    const command = createTestCommand(new TestCommandCreate("create"), { aggregate });

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
        event_name: "test_event_create",
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

    expect(errorBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "aggregate_already_created_error",
        data: {
          command: expect.objectContaining({
            input: "create",
          }),
          error: expect.objectContaining({ name: "AggregateAlreadyCreatedError" }),
          message: command,
        },
      }),
    );
  });

  test("should throw from command handler", async () => {
    const aggregate = createTestAggregateIdentifier();
    const command = createTestCommand(new TestCommandThrows("throws"), { aggregate });

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
        event_name: "test_event_create",
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
    ).rejects.toThrow(new Error("throws"));
  });
});
