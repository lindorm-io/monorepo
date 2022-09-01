import { Command, DomainEvent } from "../message";
import { IMessage, ISagaDomain, SagaIdentifier } from "../types";
import { LindormError } from "@lindorm-io/errors";
import { Saga } from "../model";
import { SagaDomain } from "./SagaDomain";
import { SagaEventHandlerImplementation } from "../handler";
import { TEST_AGGREGATE_EVENT_HANDLER } from "../fixtures/aggregate-event-handler.fixture";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import { TEST_SAGA_IDENTIFIER } from "../fixtures/saga.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import { createMockMessageBus, IMessageBus } from "@lindorm-io/amqp";
import { randomUUID } from "crypto";
import {
  HandlerNotRegisteredError,
  SagaAlreadyCreatedError,
  SagaDestroyedError,
  SagaNotCreatedError,
} from "../error";
import {
  TEST_SAGA_EVENT_HANDLER,
  TEST_SAGA_EVENT_HANDLER_CREATE,
  TEST_SAGA_EVENT_HANDLER_DESTROY,
  TEST_SAGA_EVENT_HANDLER_DISPATCH,
  TEST_SAGA_EVENT_HANDLER_MERGE_STATE,
  TEST_SAGA_EVENT_HANDLER_SET_STATE,
  TEST_SAGA_EVENT_HANDLER_THROWS,
  TEST_SAGA_EVENT_HANDLER_TIMEOUT,
} from "../fixtures/saga-event-handler.fixture";
import {
  TEST_DOMAIN_EVENT,
  TEST_DOMAIN_EVENT_CREATE,
  TEST_DOMAIN_EVENT_DISPATCH,
  TEST_DOMAIN_EVENT_MERGE_STATE,
  TEST_DOMAIN_EVENT_THROWS,
} from "../fixtures/domain-event.fixture";
import { randomString } from "@lindorm-io/core";

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
  let messageBus: IMessageBus;
  let store: any;

  beforeEach(async () => {
    messageBus = createMockMessageBus();
    store = {
      causationExists: jest.fn(),
      clearMessagesToDispatch: jest.fn(),
      clearProcessedCausationIds: jest.fn(),
      load: jest.fn(),
      processCausationIds: jest.fn(),
      save: jest.fn(),
    };

    domain = new SagaDomain({ messageBus, store: store as any }, logger);

    for (const handler of eventHandlers) {
      await domain.registerEventHandler(handler);
    }

    store.causationExists.mockResolvedValue(false);

    store.clearMessagesToDispatch.mockImplementation(
      async (saga: Saga) =>
        new Saga(
          {
            ...saga.toJSON(),
            hash: randomString(16),
            revision: saga.revision + 1,
            messagesToDispatch: [],
          },
          logger,
        ),
    );

    store.clearProcessedCausationIds.mockImplementation(
      async (saga: Saga) =>
        new Saga(
          {
            ...saga.toJSON(),
            hash: randomString(16),
            revision: saga.revision + 1,
            processedCausationIds: [],
          },
          logger,
        ),
    );

    store.load.mockImplementation(
      async (identifier: SagaIdentifier) => new Saga(identifier, logger),
    );

    store.processCausationIds.mockResolvedValue(undefined);

    store.save.mockImplementation(
      async (saga: Saga, causation: IMessage) =>
        new Saga(
          {
            ...saga.toJSON(),
            revision: saga.revision + 1,
            processedCausationIds: [...saga.processedCausationIds, causation.id],
          },
          logger,
        ),
    );
  });

  test("should register event handler", async () => {
    messageBus = createMockMessageBus();
    domain = new SagaDomain({ messageBus, store: store as any }, logger);

    await expect(domain.registerEventHandler(TEST_SAGA_EVENT_HANDLER)).resolves.toBeUndefined();

    expect(messageBus.subscribe).toHaveBeenCalledWith({
      callback: expect.any(Function),
      queue: "queue.saga.default.aggregate_name.domain_event_default.default.name",
      topic: "default.aggregate_name.domain_event_default",
    });
  });

  test("should register multiple event handlers", async () => {
    messageBus = createMockMessageBus();
    domain = new SagaDomain({ messageBus, store: store as any }, logger);

    await expect(
      domain.registerEventHandler(
        new SagaEventHandlerImplementation({
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
      queue: "queue.saga.one.aggregate_name.domain_event_default.default.name",
      topic: "one.aggregate_name.domain_event_default",
    });

    expect(messageBus.subscribe).toHaveBeenNthCalledWith(2, {
      callback: expect.any(Function),
      queue: "queue.saga.two.aggregate_name.domain_event_default.default.name",
      topic: "two.aggregate_name.domain_event_default",
    });
  });

  test("should throw on existing event handler", async () => {
    domain = new SagaDomain({ messageBus, store: store as any }, logger);

    await domain.registerEventHandler(TEST_SAGA_EVENT_HANDLER);

    await expect(domain.registerEventHandler(TEST_SAGA_EVENT_HANDLER)).rejects.toThrow(
      LindormError,
    );
  });

  test("should throw on invalid event handler", async () => {
    domain = new SagaDomain({ messageBus, store: store as any }, logger);

    // @ts-ignore
    await expect(domain.registerEventHandler(TEST_AGGREGATE_EVENT_HANDLER)).rejects.toThrow(
      LindormError,
    );
  });

  test("should handle event", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_SAGA_IDENTIFIER)).resolves.toBeUndefined();

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
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_DISPATCH, aggregate });

    store.load.mockImplementation(
      async (s: SagaIdentifier) =>
        new Saga({ ...s, revision: 1, processedCausationIds: [causationId] }, logger),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_SAGA_IDENTIFIER)).resolves.toBeUndefined();

    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: event.aggregate.id,
        name: "name",
        context: "default",
        processedCausationIds: [causationId],
        destroyed: false,
        messagesToDispatch: [expect.any(Command)],
        revision: 1,
        state: {},
      }),
      event,
    );

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        id: expect.any(String),
        name: "command_default",
        aggregate: event.aggregate,
        causationId: expect.any(String),
        correlationId: event.correlationId,
        data: { commandData: true },
        delay: 0,
        mandatory: true,
        topic: "default.aggregate_name.command_default",
        timestamp: expect.any(Date),
        type: "command",
      }),
    ]);
    expect(store.clearMessagesToDispatch).toHaveBeenCalled();
  });

  test("should skip handler when last causation matches event id", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_MERGE_STATE, aggregate });

    store.load.mockImplementation(
      async (s: SagaIdentifier) =>
        new Saga(
          {
            ...s,
            revision: 1,
            processedCausationIds: [event.id],
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_SAGA_IDENTIFIER)).resolves.toBeUndefined();

    expect(store.save).not.toHaveBeenCalled();
    expect(messageBus.publish).not.toHaveBeenCalled();
    expect(store.clearMessagesToDispatch).not.toHaveBeenCalled();
  });

  test("should throw on missing handler", async () => {
    domain = new SagaDomain({ messageBus, store: store as any }, logger);

    const event = new DomainEvent(TEST_DOMAIN_EVENT);

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_SAGA_IDENTIFIER)).rejects.toThrow(
      HandlerNotRegisteredError,
    );
  });

  test("should dispatch error on destroyed saga", async () => {
    const event = new DomainEvent(TEST_DOMAIN_EVENT);

    store.load.mockImplementation(
      async (s: SagaIdentifier) =>
        new Saga(
          {
            ...s,
            destroyed: true,
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_SAGA_IDENTIFIER)).resolves.toBeUndefined();

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "SagaDestroyedError",
        data: {
          error: expect.any(SagaDestroyedError),
          message: event,
        },
      }),
    ]);
  });

  test("should throw on not created saga", async () => {
    const event = new DomainEvent(TEST_DOMAIN_EVENT_MERGE_STATE);

    store.load.mockImplementation(
      async (s: SagaIdentifier) =>
        new Saga(
          {
            ...s,
            revision: 0,
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_SAGA_IDENTIFIER)).rejects.toThrow(
      SagaNotCreatedError,
    );

    expect(messageBus.publish).not.toHaveBeenCalled();
  });

  test("should dispatch error on not created saga", async () => {
    domain = new SagaDomain({ messageBus, store: store as any }, logger);

    await domain.registerEventHandler(
      new SagaEventHandlerImplementation({
        ...TEST_SAGA_EVENT_HANDLER_MERGE_STATE,
        conditions: {
          created: true,
          permanent: true,
        },
      }),
    );

    const event = new DomainEvent(TEST_DOMAIN_EVENT_MERGE_STATE);

    store.load.mockImplementation(
      async (s: SagaIdentifier) =>
        new Saga(
          {
            ...s,
            revision: 0,
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_SAGA_IDENTIFIER)).resolves.toBeUndefined();

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "SagaNotCreatedError",
        data: {
          error: expect.any(SagaNotCreatedError),
          message: event,
        },
      }),
    ]);
  });

  test("should throw on already created saga", async () => {
    domain = new SagaDomain({ messageBus, store: store as any }, logger);

    await domain.registerEventHandler(
      new SagaEventHandlerImplementation({
        ...TEST_SAGA_EVENT_HANDLER_CREATE,
        conditions: {
          created: false,
          permanent: false,
        },
      }),
    );

    const event = new DomainEvent(TEST_DOMAIN_EVENT_CREATE);

    store.load.mockImplementation(
      async (s: SagaIdentifier) =>
        new Saga(
          {
            ...s,
            revision: 1,
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_SAGA_IDENTIFIER)).rejects.toThrow(
      SagaAlreadyCreatedError,
    );

    expect(messageBus.publish).not.toHaveBeenCalled();
  });

  test("should dispatch error on already created saga", async () => {
    const event = new DomainEvent(TEST_DOMAIN_EVENT_CREATE);

    store.load.mockImplementation(
      async (s: SagaIdentifier) =>
        new Saga(
          {
            ...s,
            revision: 1,
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_SAGA_IDENTIFIER)).resolves.toBeUndefined();

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "SagaAlreadyCreatedError",
        data: {
          error: expect.any(SagaAlreadyCreatedError),
          message: event,
        },
      }),
    ]);
  });

  test("should throw from event handler", async () => {
    const event = new DomainEvent(TEST_DOMAIN_EVENT_THROWS);

    store.load.mockImplementation(
      async (s: SagaIdentifier) =>
        new Saga(
          {
            ...s,
            revision: 1,
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_SAGA_IDENTIFIER)).rejects.toThrow(
      new Error("throw"),
    );

    expect(messageBus.publish).not.toHaveBeenCalled();
  });
});
