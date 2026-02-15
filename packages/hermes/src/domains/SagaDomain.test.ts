import { createMockLogger } from "@lindorm/logger";
import { IMongoSource, MongoSource } from "@lindorm/mongo";
import { createMockRabbitMessageBus, IRabbitSource, RabbitSource } from "@lindorm/rabbit";
import { Dict } from "@lindorm/types";
import { sleep } from "@lindorm/utils";
import { randomUUID } from "crypto";
import { createTestEvent } from "../__fixtures__/create-message";
import { createTestAggregateIdentifier } from "../__fixtures__/create-test-aggregate-identifier";
import { createTestRegistry } from "../__fixtures__/create-test-registry";
import { createTestSagaIdentifier } from "../__fixtures__/create-test-saga-identifier";
import { TestEventCreate } from "../__fixtures__/modules/events/TestEventCreate";
import { TestEventDestroy } from "../__fixtures__/modules/events/TestEventDestroy";
import { TestEventDispatch } from "../__fixtures__/modules/events/TestEventDispatch";
import { TestEventMergeState } from "../__fixtures__/modules/events/TestEventMergeState";
import { TestEventSetState } from "../__fixtures__/modules/events/TestEventSetState";
import { TestEventThrows } from "../__fixtures__/modules/events/TestEventThrows";
import { SagaNotCreatedError } from "../errors";
import { MessageBus, SagaStore } from "../infrastructure";
import {
  IHermesMessage,
  IHermesMessageBus,
  IHermesRegistry,
  ISagaDomain,
  ISagaModel,
} from "../interfaces";
import { HermesCommand, HermesError, HermesEvent, HermesTimeout } from "../messages";
import { AggregateIdentifier, SagaIdentifier } from "../types";
import { SagaDomain } from "./SagaDomain";

describe("SagaDomain", () => {
  const logger = createMockLogger();

  let domain: ISagaDomain;
  let commandBus: IHermesMessageBus<HermesCommand<Dict>>;
  let errorBus: IHermesMessageBus<HermesError>;
  let eventBus: IHermesMessageBus<HermesEvent<Dict>>;
  let timeoutBus: IHermesMessageBus<HermesTimeout>;
  let store: any;

  beforeEach(async () => {
    commandBus = createMockRabbitMessageBus(HermesCommand);
    errorBus = createMockRabbitMessageBus(HermesError);
    eventBus = createMockRabbitMessageBus(HermesEvent);
    timeoutBus = createMockRabbitMessageBus(HermesTimeout);

    store = {
      clearMessages: jest.fn().mockImplementation(async (saga: ISagaModel) => ({
        ...saga.toJSON(),
        revision: saga.revision + 1,
        messagesToDispatch: [],
      })),
      load: jest.fn().mockImplementation(async (identifier: SagaIdentifier) => ({
        ...identifier,
      })),
      loadCausations: jest.fn().mockResolvedValue([]),
      save: jest
        .fn()
        .mockImplementation(async (saga: ISagaModel, causation: IHermesMessage) => ({
          ...saga.toJSON(),
          revision: saga.revision + 1,
          processedCausationIds: [...saga.processedCausationIds, causation.id],
        })),
      saveCausations: jest.fn().mockImplementation(async (saga: ISagaModel) => ({
        ...saga.toJSON(),
        revision: saga.revision + 1,
        processedCausationIds: [],
      })),
    };

    domain = new SagaDomain({
      commandBus,
      errorBus,
      eventBus,
      logger,
      registry: createTestRegistry(),
      store: store as any,
      timeoutBus,
    });

    await domain.registerHandlers();
  });

  test("should register event handler", async () => {
    expect(eventBus.subscribe).toHaveBeenCalledWith({
      callback: expect.any(Function),
      queue: "queue.saga.hermes.test_aggregate.test_event_create.hermes.test_saga",
      topic: "hermes.test_aggregate.test_event_create",
    });
  });

  test("should handle event", async () => {
    const aggregate = createTestAggregateIdentifier();
    const event = createTestEvent(new TestEventCreate("create"), { aggregate });

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, createTestSagaIdentifier()),
    ).resolves.toBeUndefined();

    expect(store.load).toHaveBeenCalledWith({
      id: event.aggregate.id,
      name: "test_saga",
      namespace: "hermes",
    });

    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: event.aggregate.id,
        name: "test_saga",
        namespace: "hermes",
        processedCausationIds: [],
        destroyed: false,
        messagesToDispatch: [],
        revision: 0,
        state: { create: "create" },
      }),
      event,
    );

    expect(commandBus.publish).not.toHaveBeenCalled();
    expect(errorBus.publish).not.toHaveBeenCalled();
    expect(timeoutBus.publish).not.toHaveBeenCalled();
    expect(store.clearMessages).not.toHaveBeenCalled();
    expect(store.saveCausations).toHaveBeenCalled();
  });

  test("should handle event and dispatch commands", async () => {
    const aggregate = createTestAggregateIdentifier();
    const causationId = randomUUID();
    const event = createTestEvent(new TestEventDispatch("dispatch"), { aggregate });

    store.load.mockImplementation(async (s: SagaIdentifier) => ({
      ...s,
      revision: 1,
      processedCausationIds: [causationId],
    }));

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, createTestSagaIdentifier()),
    ).resolves.toBeUndefined();

    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: event.aggregate.id,
        name: "test_saga",
        namespace: "hermes",
        processedCausationIds: [causationId],
        destroyed: false,
        messagesToDispatch: [expect.any(HermesCommand)],
        revision: 1,
        state: { dispatch: "dispatch" },
      }),
      event,
    );

    expect(commandBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        id: expect.any(String),
        aggregate: event.aggregate,
        causationId: expect.any(String),
        correlationId: event.correlationId,
        data: { input: "dispatch" },
        delay: 0,
        mandatory: true,
        meta: { origin: "test" },
        name: "test_command_merge_state",
        version: 1,
      }),
    ]);

    expect(store.clearMessages).toHaveBeenCalled();
  });

  test("should skip handler when saga causations matches event id", async () => {
    const aggregate = createTestAggregateIdentifier();
    const event = createTestEvent(new TestEventMergeState("merge-state"), { aggregate });

    store.load.mockImplementation(async (s: SagaIdentifier) => ({
      ...s,
      revision: 1,
      processedCausationIds: [event.id],
    }));

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, createTestSagaIdentifier()),
    ).resolves.toBeUndefined();

    expect(store.save).not.toHaveBeenCalled();
    expect(commandBus.publish).not.toHaveBeenCalled();
    expect(store.clearMessages).not.toHaveBeenCalled();
    expect(store.saveCausations).toHaveBeenCalled();
  });

  test("should skip handler when loaded causations matches event id", async () => {
    const aggregate = createTestAggregateIdentifier();
    const event = createTestEvent(new TestEventMergeState("merge-state"), { aggregate });

    store.loadCausations.mockImplementation(async () => [event.id]);

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, createTestSagaIdentifier()),
    ).resolves.toBeUndefined();

    expect(store.save).not.toHaveBeenCalled();
    expect(commandBus.publish).not.toHaveBeenCalled();
    expect(store.clearMessages).not.toHaveBeenCalled();
    expect(store.saveCausations).not.toHaveBeenCalled();
  });

  test("should dispatch error on destroyed saga", async () => {
    const event = createTestEvent(new TestEventCreate("create"));

    store.load.mockImplementation(async (s: SagaIdentifier) => ({
      ...s,
      destroyed: true,
    }));

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, createTestSagaIdentifier()),
    ).resolves.toBeUndefined();

    expect(errorBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "saga_destroyed_error",
        data: {
          error: expect.objectContaining({ name: "SagaDestroyedError" }),
          event: expect.objectContaining({
            input: "create",
          }),
          message: event,
          saga: {
            id: expect.any(String),
            name: "test_saga",
            namespace: "hermes",
          },
        },
      }),
    );
  });

  test("should throw on not created saga", async () => {
    const event = createTestEvent(new TestEventDestroy("destroy"));

    store.load.mockImplementation(async (s: SagaIdentifier) => ({
      ...s,
      revision: 0,
    }));

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, createTestSagaIdentifier()),
    ).rejects.toThrow(SagaNotCreatedError);

    expect(commandBus.publish).not.toHaveBeenCalled();
  });

  test("should dispatch error on already created saga", async () => {
    const event = createTestEvent(new TestEventCreate("create"));

    store.load.mockImplementation(async (s: SagaIdentifier) => ({
      ...s,
      revision: 1,
    }));

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, createTestSagaIdentifier()),
    ).resolves.toBeUndefined();

    expect(errorBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "saga_already_created_error",
        data: {
          error: expect.objectContaining({ name: "SagaAlreadyCreatedError" }),
          event: expect.objectContaining({
            input: "create",
          }),
          message: event,
          saga: {
            id: expect.any(String),
            name: "test_saga",
            namespace: "hermes",
          },
        },
      }),
    );
  });

  test("should throw from event handler", async () => {
    const event = createTestEvent(new TestEventThrows("throws"));

    store.load.mockImplementation(async (s: SagaIdentifier) => ({
      ...s,
      revision: 1,
    }));

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, createTestSagaIdentifier()),
    ).rejects.toThrow(new Error("throws"));

    expect(commandBus.publish).not.toHaveBeenCalled();
  });
});

describe("SagaDomain (integration)", () => {
  const namespace = "sag_dom";
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let commandBus: MessageBus<HermesCommand<Dict>>;
  let domain: SagaDomain;
  let errorBus: MessageBus<HermesError>;
  let eventBus: MessageBus<HermesEvent<Dict>>;
  let mongo: IMongoSource;
  let rabbit: IRabbitSource;
  let registry: IHermesRegistry;
  let saga: SagaIdentifier;
  let store: SagaStore;
  let timeoutBus: MessageBus<HermesTimeout>;

  beforeAll(async () => {
    mongo = new MongoSource({
      database: "MongoSagaDomain",
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
    timeoutBus = new MessageBus({ Message: HermesTimeout, rabbit, logger });

    store = new SagaStore({ mongo, logger });

    aggregate = createTestAggregateIdentifier(namespace);
    saga = { ...createTestSagaIdentifier(namespace), id: aggregate.id };

    registry = createTestRegistry(namespace);

    domain = new SagaDomain({
      commandBus,
      errorBus,
      eventBus,
      logger,
      registry,
      store,
      timeoutBus,
    });

    await domain.registerHandlers();
  });

  afterAll(async () => {
    await mongo.disconnect();
    await rabbit.disconnect();
  });

  test("should handle multiple published events", async () => {
    const eventCreate = createTestEvent(new TestEventCreate("create"), {
      aggregate,
    });
    const eventMergeState = createTestEvent(new TestEventMergeState("merge-state"), {
      aggregate,
    });
    const eventSetState = createTestEvent(new TestEventSetState("set-state"), {
      aggregate,
    });
    const eventDestroy = createTestEvent(new TestEventDestroy("destroy"), {
      aggregate,
    });

    await expect(eventBus.publish(eventCreate)).resolves.toBeUndefined();
    await sleep(500);

    await expect(eventBus.publish(eventMergeState)).resolves.toBeUndefined();
    await sleep(500);

    await expect(eventBus.publish(eventSetState)).resolves.toBeUndefined();
    await sleep(500);

    await expect(eventBus.publish(eventDestroy)).resolves.toBeUndefined();
    await sleep(500);

    await expect(store.load(saga)).resolves.toEqual(
      expect.objectContaining({
        id: aggregate.id,
        name: "test_saga",
        namespace: namespace,
        processedCausationIds: [],
        destroyed: true,
        messagesToDispatch: [],
        revision: 8,
        state: {
          create: "create",
          destroy: "destroy",
          mergeState: "merge-state",
          setState: "set-state",
        },
      }),
    );
  }, 30000);
});
