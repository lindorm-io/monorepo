import { LindormError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
import { createMockRabbitMessageBus } from "@lindorm/rabbit";
import { randomString } from "@lindorm/random";
import { randomUUID } from "crypto";
import { TEST_AGGREGATE_IDENTIFIER } from "../__fixtures__/aggregate";
import { TEST_AGGREGATE_EVENT_HANDLER } from "../__fixtures__/aggregate-event-handler";
import {
  TEST_HERMES_EVENT,
  TEST_HERMES_EVENT_CREATE,
  TEST_HERMES_EVENT_DISPATCH,
  TEST_HERMES_EVENT_MERGE_STATE,
  TEST_HERMES_EVENT_THROWS,
} from "../__fixtures__/hermes-event";
import { TEST_SAGA_IDENTIFIER } from "../__fixtures__/saga";
import {
  TEST_SAGA_EVENT_HANDLER,
  TEST_SAGA_EVENT_HANDLER_CREATE,
  TEST_SAGA_EVENT_HANDLER_DESTROY,
  TEST_SAGA_EVENT_HANDLER_DISPATCH,
  TEST_SAGA_EVENT_HANDLER_MERGE_STATE,
  TEST_SAGA_EVENT_HANDLER_SET_STATE,
  TEST_SAGA_EVENT_HANDLER_THROWS,
  TEST_SAGA_EVENT_HANDLER_TIMEOUT,
} from "../__fixtures__/saga-event-handler";
import {
  HandlerNotRegisteredError,
  SagaAlreadyCreatedError,
  SagaDestroyedError,
  SagaNotCreatedError,
} from "../errors";
import { HermesSagaEventHandler } from "../handlers";
import { IHermesMessage, IHermesMessageBus, ISagaDomain } from "../interfaces";
import { HermesCommand, HermesEvent } from "../messages";
import { Saga } from "../models";
import { SagaIdentifier } from "../types";
import { SagaDomain } from "./SagaDomain";

describe("SagaDomain", () => {
  const logger = createMockLogger();
  const eventHandlers = [
    TEST_SAGA_EVENT_HANDLER,
    TEST_SAGA_EVENT_HANDLER_CREATE,
    TEST_SAGA_EVENT_HANDLER_DESTROY,
    TEST_SAGA_EVENT_HANDLER_DISPATCH,
    TEST_SAGA_EVENT_HANDLER_MERGE_STATE,
    TEST_SAGA_EVENT_HANDLER_SET_STATE,
    TEST_SAGA_EVENT_HANDLER_TIMEOUT,
    TEST_SAGA_EVENT_HANDLER_THROWS,
  ];

  let domain: ISagaDomain;
  let messageBus: IHermesMessageBus;
  let store: any;

  beforeEach(async () => {
    messageBus = createMockRabbitMessageBus(HermesEvent);
    store = {
      causationExists: jest.fn(),
      clearMessagesToDispatch: jest.fn(),
      clearProcessedCausationIds: jest.fn(),
      load: jest.fn(),
      processCausationIds: jest.fn(),
      save: jest.fn(),
    };

    domain = new SagaDomain({ messageBus, store: store as any, logger });

    for (const handler of eventHandlers) {
      await domain.registerEventHandler(handler);
    }

    store.causationExists.mockResolvedValue(false);

    store.clearMessagesToDispatch.mockImplementation(
      async (saga: Saga) =>
        new Saga({
          ...saga.toJSON(),
          hash: randomString(16),
          revision: saga.revision + 1,
          messagesToDispatch: [],
          logger,
        }),
    );

    store.clearProcessedCausationIds.mockImplementation(
      async (saga: Saga) =>
        new Saga({
          ...saga.toJSON(),
          hash: randomString(16),
          revision: saga.revision + 1,
          processedCausationIds: [],
          logger,
        }),
    );

    store.load.mockImplementation(
      async (identifier: SagaIdentifier) => new Saga({ ...identifier, logger }),
    );

    store.processCausationIds.mockResolvedValue(undefined);

    store.save.mockImplementation(
      async (saga: Saga, causation: IHermesMessage) =>
        new Saga({
          ...saga.toJSON(),
          revision: saga.revision + 1,
          processedCausationIds: [...saga.processedCausationIds, causation.id],
          logger,
        }),
    );
  });

  test("should register event handler", async () => {
    messageBus = createMockRabbitMessageBus(HermesEvent);
    domain = new SagaDomain({ messageBus, store: store as any, logger });

    await expect(
      domain.registerEventHandler(TEST_SAGA_EVENT_HANDLER),
    ).resolves.toBeUndefined();

    expect(messageBus.subscribe).toHaveBeenCalledWith({
      callback: expect.any(Function),
      queue: "queue.saga.default.aggregate_name.hermes_event_default.default.name",
      topic: "default.aggregate_name.hermes_event_default",
    });
  });

  test("should register multiple event handlers", async () => {
    messageBus = createMockRabbitMessageBus(HermesEvent);
    domain = new SagaDomain({ messageBus, store: store as any, logger });

    await expect(
      domain.registerEventHandler(
        new HermesSagaEventHandler({
          ...TEST_SAGA_EVENT_HANDLER,
          aggregate: {
            ...TEST_SAGA_EVENT_HANDLER.aggregate,
            context: ["one", "two"],
          },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(messageBus.subscribe).toHaveBeenCalledTimes(2);

    expect(messageBus.subscribe).toHaveBeenNthCalledWith(1, {
      callback: expect.any(Function),
      queue: "queue.saga.one.aggregate_name.hermes_event_default.default.name",
      topic: "one.aggregate_name.hermes_event_default",
    });

    expect(messageBus.subscribe).toHaveBeenNthCalledWith(2, {
      callback: expect.any(Function),
      queue: "queue.saga.two.aggregate_name.hermes_event_default.default.name",
      topic: "two.aggregate_name.hermes_event_default",
    });
  });

  test("should throw on existing event handler", async () => {
    domain = new SagaDomain({ messageBus, store: store as any, logger });

    await domain.registerEventHandler(TEST_SAGA_EVENT_HANDLER);

    await expect(domain.registerEventHandler(TEST_SAGA_EVENT_HANDLER)).rejects.toThrow(
      LindormError,
    );
  });

  test("should throw on invalid event handler", async () => {
    domain = new SagaDomain({ messageBus, store: store as any, logger });

    await expect(
      // @ts-expect-error
      domain.registerEventHandler(TEST_AGGREGATE_EVENT_HANDLER),
    ).rejects.toThrow(LindormError);
  });

  test("should handle event", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const event = new HermesEvent({ ...TEST_HERMES_EVENT_CREATE, aggregate });

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, TEST_SAGA_IDENTIFIER),
    ).resolves.toBeUndefined();

    expect(store.load).toHaveBeenCalledWith({
      id: event.aggregate.id,
      name: "name",
      context: "default",
    });

    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: event.aggregate.id,
        name: "name",
        context: "default",
        processedCausationIds: [],
        destroyed: false,
        messagesToDispatch: [],
        revision: 0,
        state: {
          created: true,
        },
      }),
      event,
    );

    expect(messageBus.publish).not.toHaveBeenCalled();
    expect(store.clearMessagesToDispatch).not.toHaveBeenCalled();
  });

  test("should handle event and dispatch commands", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const causationId = randomUUID();
    const event = new HermesEvent({ ...TEST_HERMES_EVENT_DISPATCH, aggregate });

    store.load.mockImplementation(
      async (s: SagaIdentifier) =>
        new Saga({ ...s, revision: 1, processedCausationIds: [causationId], logger }),
    );

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, TEST_SAGA_IDENTIFIER),
    ).resolves.toBeUndefined();

    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: event.aggregate.id,
        name: "name",
        context: "default",
        processedCausationIds: [causationId],
        destroyed: false,
        messagesToDispatch: [expect.any(HermesCommand)],
        revision: 1,
        state: {},
      }),
      event,
    );

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        id: expect.any(String),
        aggregate: event.aggregate,
        causationId: expect.any(String),
        correlationId: event.correlationId,
        data: { commandData: true },
        delay: 0,
        mandatory: true,
        meta: { origin: "test" },
        name: "command_default",
        // topic: "default.aggregate_name.command_default",
        type: "HermesCommand",
        version: 1,
      }),
    ]);

    expect(store.clearMessagesToDispatch).toHaveBeenCalled();
  });

  test("should skip handler when last causation matches event id", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const event = new HermesEvent({ ...TEST_HERMES_EVENT_MERGE_STATE, aggregate });

    store.load.mockImplementation(
      async (s: SagaIdentifier) =>
        new Saga({
          ...s,
          revision: 1,
          processedCausationIds: [event.id],
          logger,
        }),
    );

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, TEST_SAGA_IDENTIFIER),
    ).resolves.toBeUndefined();

    expect(store.save).not.toHaveBeenCalled();
    expect(messageBus.publish).not.toHaveBeenCalled();
    expect(store.clearMessagesToDispatch).not.toHaveBeenCalled();
  });

  test("should throw on missing handler", async () => {
    domain = new SagaDomain({ messageBus, store: store as any, logger });

    const event = new HermesEvent(TEST_HERMES_EVENT);

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, TEST_SAGA_IDENTIFIER),
    ).rejects.toThrow(HandlerNotRegisteredError);
  });

  test("should dispatch error on destroyed saga", async () => {
    const event = new HermesEvent(TEST_HERMES_EVENT);

    store.load.mockImplementation(
      async (s: SagaIdentifier) =>
        new Saga({
          ...s,
          destroyed: true,
          logger,
        }),
    );

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, TEST_SAGA_IDENTIFIER),
    ).resolves.toBeUndefined();

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "saga_destroyed_error",
        data: {
          error: expect.any(SagaDestroyedError),
          message: event,
          saga: {
            id: expect.any(String),
            name: "name",
            context: "default",
          },
        },
      }),
    ]);
  });

  test("should throw on not created saga", async () => {
    const event = new HermesEvent(TEST_HERMES_EVENT_MERGE_STATE);

    store.load.mockImplementation(
      async (s: SagaIdentifier) =>
        new Saga({
          ...s,
          revision: 0,
          logger,
        }),
    );

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, TEST_SAGA_IDENTIFIER),
    ).rejects.toThrow(SagaNotCreatedError);

    expect(messageBus.publish).not.toHaveBeenCalled();
  });

  test("should dispatch error on not created saga", async () => {
    domain = new SagaDomain({ messageBus, store: store as any, logger });

    await domain.registerEventHandler(
      new HermesSagaEventHandler({
        ...TEST_SAGA_EVENT_HANDLER_MERGE_STATE,
        conditions: {
          created: true,
          permanent: true,
        },
      }),
    );

    const event = new HermesEvent(TEST_HERMES_EVENT_MERGE_STATE);

    store.load.mockImplementation(
      async (s: SagaIdentifier) =>
        new Saga({
          ...s,
          revision: 0,
          logger,
        }),
    );

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, TEST_SAGA_IDENTIFIER),
    ).resolves.toBeUndefined();

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "saga_not_created_error",
        data: {
          error: expect.any(SagaNotCreatedError),
          message: event,
          saga: {
            id: expect.any(String),
            name: "name",
            context: "default",
          },
        },
      }),
    ]);
  });

  test("should throw on already created saga", async () => {
    domain = new SagaDomain({ messageBus, store: store as any, logger });

    await domain.registerEventHandler(
      new HermesSagaEventHandler({
        ...TEST_SAGA_EVENT_HANDLER_CREATE,
        conditions: {
          created: false,
          permanent: false,
        },
      }),
    );

    const event = new HermesEvent(TEST_HERMES_EVENT_CREATE);

    store.load.mockImplementation(
      async (s: SagaIdentifier) =>
        new Saga({
          ...s,
          revision: 1,
          logger,
        }),
    );

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, TEST_SAGA_IDENTIFIER),
    ).rejects.toThrow(SagaAlreadyCreatedError);

    expect(messageBus.publish).not.toHaveBeenCalled();
  });

  test("should dispatch error on already created saga", async () => {
    const event = new HermesEvent(TEST_HERMES_EVENT_CREATE);

    store.load.mockImplementation(
      async (s: SagaIdentifier) =>
        new Saga({
          ...s,
          revision: 1,
          logger,
        }),
    );

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, TEST_SAGA_IDENTIFIER),
    ).resolves.toBeUndefined();

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "saga_already_created_error",
        data: {
          error: expect.any(SagaAlreadyCreatedError),
          message: event,
          saga: {
            id: expect.any(String),
            name: "name",
            context: "default",
          },
        },
      }),
    ]);
  });

  test("should throw from event handler", async () => {
    const event = new HermesEvent(TEST_HERMES_EVENT_THROWS);

    store.load.mockImplementation(
      async (s: SagaIdentifier) =>
        new Saga({
          ...s,
          revision: 1,
          logger,
        }),
    );

    await expect(
      // @ts-expect-error
      domain.handleEvent(event, TEST_SAGA_IDENTIFIER),
    ).rejects.toThrow(new Error("throw"));

    expect(messageBus.publish).not.toHaveBeenCalled();
  });
});
