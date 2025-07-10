import { createMockLogger } from "@lindorm/logger";
import { createMockRabbitMessageBus } from "@lindorm/rabbit";
import { Dict } from "@lindorm/types";
import { randomUUID } from "crypto";
import { createTestEvent } from "../__fixtures__/create-message";
import { createTestAggregateIdentifier } from "../__fixtures__/create-test-aggregate-identifier";
import { createTestRegistry } from "../__fixtures__/create-test-registry";
import { createTestSagaIdentifier } from "../__fixtures__/create-test-saga-identifier";
import { TestEventCreate } from "../__fixtures__/modules/events/TestEventCreate";
import { TestEventDestroy } from "../__fixtures__/modules/events/TestEventDestroy";
import { TestEventDispatch } from "../__fixtures__/modules/events/TestEventDispatch";
import { TestEventMergeState } from "../__fixtures__/modules/events/TestEventMergeState";
import { TestEventThrows } from "../__fixtures__/modules/events/TestEventThrows";
import { SagaNotCreatedError } from "../errors";
import {
  IHermesMessage,
  IHermesMessageBus,
  ISagaDomain,
  ISagaModel,
} from "../interfaces";
import { HermesCommand, HermesError, HermesEvent, HermesTimeout } from "../messages";
import { SagaIdentifier } from "../types";
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
      context: "hermes",
    });

    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: event.aggregate.id,
        name: "test_saga",
        context: "hermes",
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
        context: "hermes",
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
            context: "hermes",
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
            context: "hermes",
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
