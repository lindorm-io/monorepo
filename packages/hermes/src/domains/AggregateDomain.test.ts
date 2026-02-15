import { createMockAesKit } from "@lindorm/aes";
import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { createMockRabbitMessageBus, IRabbitSource, RabbitSource } from "@lindorm/rabbit";
import { Dict } from "@lindorm/types";
import { sleep } from "@lindorm/utils";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import { createTestCommand } from "../__fixtures__/create-message";
import { createTestAggregateIdentifier } from "../__fixtures__/create-test-aggregate-identifier";
import { createTestRegistry } from "../__fixtures__/create-test-registry";
import { TestCommandCreate } from "../__fixtures__/modules/commands/TestCommandCreate";
import { TestCommandDestroy } from "../__fixtures__/modules/commands/TestCommandDestroy";
import { TestCommandDestroyNext } from "../__fixtures__/modules/commands/TestCommandDestroyNext";
import { TestCommandEncrypt } from "../__fixtures__/modules/commands/TestCommandEncrypt";
import { TestCommandMergeState } from "../__fixtures__/modules/commands/TestCommandMergeState";
import { TestCommandThrows } from "../__fixtures__/modules/commands/TestCommandThrows";
import { EncryptionStore, EventStore, MessageBus } from "../infrastructure";
import {
  AggregateAlreadyCreatedError,
  AggregateDestroyedError,
  AggregateNotCreatedError,
} from "../errors";
import {
  IAggregateDomain,
  IEventStore,
  IHermesEncryptionStore,
  IHermesMessageBus,
  IHermesRegistry,
} from "../interfaces";
import { HermesCommand, HermesError, HermesEvent } from "../messages";
import { AggregateIdentifier } from "../types";
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
        aggregate_namespace: "hermes",
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
        aggregate_namespace: "hermes",
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
        aggregate_namespace: aggregate.namespace,
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
        aggregate_namespace: aggregate.namespace,
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
        namespace: "hermes",
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
        aggregate_namespace: aggregate.namespace,
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
        aggregate_namespace: aggregate.namespace,
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
        aggregate_namespace: aggregate.namespace,
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

describe("AggregateDomain (integration)", () => {
  const namespace = "agg_dom";
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let commandBus: IHermesMessageBus<HermesCommand<Dict>>;
  let domain: IAggregateDomain;
  let encryptionStore: IHermesEncryptionStore;
  let errorBus: IHermesMessageBus<HermesError>;
  let eventBus: IHermesMessageBus<HermesEvent<Dict>>;
  let eventStore: IEventStore;
  let mongo: IMongoSource;
  let rabbit: IRabbitSource;
  let registry: IHermesRegistry;

  beforeAll(async () => {
    mongo = new MongoSource({
      database: "MongoAggregateDomain",
      logger,
      url: "mongodb://root:example@localhost/admin?authSource=admin",
    });
    await mongo.setup();

    rabbit = new RabbitSource({
      logger,
      url: "amqp://localhost:5672",
    });
    await rabbit.setup();

    commandBus = new MessageBus({ Message: HermesCommand, rabbit, logger });
    errorBus = new MessageBus({ Message: HermesError, rabbit, logger });
    eventBus = new MessageBus({ Message: HermesEvent, rabbit, logger });

    encryptionStore = new EncryptionStore({ mongo, logger });
    eventStore = new EventStore({ mongo, logger });

    aggregate = createTestAggregateIdentifier(namespace);

    registry = createTestRegistry(namespace);

    domain = new AggregateDomain({
      commandBus,
      encryptionStore,
      errorBus,
      eventBus,
      eventStore,
      logger,
      registry,
    });

    await domain.registerHandlers();
  });

  afterAll(async () => {
    await mongo.disconnect();
    await rabbit.disconnect();
  });

  test("should handle multiple published commands", async () => {
    const commandCreate = createTestCommand(new TestCommandCreate("create"), {
      aggregate,
    });

    const commandMergeState = createTestCommand(
      new TestCommandMergeState("merge-state"),
      { aggregate },
    );

    const commandEncrypt = createTestCommand(new TestCommandEncrypt("encrypt"), {
      aggregate,
    });

    const commandDestroyNext = createTestCommand(
      new TestCommandDestroyNext("destroy-next"),
      { aggregate },
    );

    const commandDestroy = createTestCommand(new TestCommandDestroy("destroy"), {
      aggregate,
    });

    await expect(commandBus.publish(commandCreate)).resolves.toBeUndefined();
    await sleep(500);

    await expect(commandBus.publish(commandMergeState)).resolves.toBeUndefined();
    await sleep(500);

    await expect(commandBus.publish(commandEncrypt)).resolves.toBeUndefined();
    await sleep(500);

    await expect(commandBus.publish(commandDestroyNext)).resolves.toBeUndefined();
    await sleep(500);

    await expect(commandBus.publish(commandDestroy)).resolves.toBeUndefined();
    await sleep(500);

    await expect(domain.inspect(aggregate)).resolves.toEqual(
      expect.objectContaining({
        id: aggregate.id,
        name: "test_aggregate",
        namespace: namespace,
        destroyed: true,
        events: [
          expect.objectContaining({
            causationId: commandCreate.id,
            correlationId: commandCreate.correlationId,
            name: "test_event_create",
          }),
          expect.objectContaining({
            causationId: commandMergeState.id,
            correlationId: commandMergeState.correlationId,
            name: "test_event_merge_state",
          }),
          expect.objectContaining({
            causationId: commandEncrypt.id,
            correlationId: commandEncrypt.correlationId,
            name: "test_event_encrypt",
          }),
          expect.objectContaining({
            causationId: commandDestroyNext.id,
            correlationId: commandDestroyNext.correlationId,
            name: "test_event_destroy_next",
          }),
          expect.objectContaining({
            causationId: commandDestroy.id,
            correlationId: commandDestroy.correlationId,
            name: "test_event_destroy",
          }),
        ],
        numberOfLoadedEvents: 5,
        state: {
          create: "create",
          destroy: "destroy",
          destroyNext: "destroy next",
          encrypt: "encrypt",
          mergeState: "merge state",
        },
      }),
    );

    await expect(encryptionStore.inspect(aggregate)).resolves.toEqual({
      id: aggregate.id,
      name: "test_aggregate",
      namespace: namespace,
      key_algorithm: "dir",
      key_curve: null,
      key_encryption: null,
      key_id: expect.any(String),
      key_type: "oct",
      private_key: expect.any(String),
      public_key: expect.any(String),
      created_at: expect.any(Date),
    });

    await expect(eventStore.find(aggregate)).resolves.toEqual([
      expect.objectContaining({
        causation_id: commandCreate.id,
        correlation_id: commandCreate.correlationId,
        event_name: "test_event_create",
      }),
      expect.objectContaining({
        causation_id: commandMergeState.id,
        correlation_id: commandMergeState.correlationId,
        event_name: "test_event_merge_state",
      }),
      expect.objectContaining({
        causation_id: commandEncrypt.id,
        correlation_id: commandEncrypt.correlationId,
        event_name: "test_event_encrypt",
        data: {
          algorithm: "dir",
          authTag: expect.any(String),
          content: expect.any(String),
          contentType: "application/octet-stream",
          encryption: "A256GCM",
          initialisationVector: expect.any(String),
          keyId: expect.any(String),
          version: expect.any(Number),
        },
      }),
      expect.objectContaining({
        causation_id: commandDestroyNext.id,
        correlation_id: commandDestroyNext.correlationId,
        event_name: "test_event_destroy_next",
      }),
      expect.objectContaining({
        causation_id: commandDestroy.id,
        correlation_id: commandDestroy.correlationId,
        event_name: "test_event_destroy",
      }),
    ]);
  }, 30000);
});
