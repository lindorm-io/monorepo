import { DomainEvent } from "../message";
import { IMessage, IViewDomain, ViewIdentifier } from "../types";
import { LindormError } from "@lindorm-io/errors";
import { MessageBus } from "../infrastructure";
import { TEST_AGGREGATE_EVENT_HANDLER } from "../fixtures/aggregate-event-handler.fixture";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import { TEST_VIEW_IDENTIFIER } from "../fixtures/view.fixture";
import { View } from "../model";
import { ViewDomain } from "./ViewDomain";
import { ViewEventHandlerImplementation } from "../handler";
import { createMockLogger } from "@lindorm-io/core-logger";
import { createMockMessageBus, IMessageBus } from "@lindorm-io/amqp";
import { randomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";
import {
  HandlerNotRegisteredError,
  ViewAlreadyCreatedError,
  ViewDestroyedError,
  ViewNotCreatedError,
} from "../error";
import {
  TEST_VIEW_EVENT_HANDLER,
  TEST_VIEW_EVENT_HANDLER_CREATE,
  TEST_VIEW_EVENT_HANDLER_DESTROY,
  TEST_VIEW_EVENT_HANDLER_MERGE_STATE,
  TEST_VIEW_EVENT_HANDLER_SET_STATE,
  TEST_VIEW_EVENT_HANDLER_THROWS,
} from "../fixtures/view-event-handler.fixture";
import {
  TEST_DOMAIN_EVENT,
  TEST_DOMAIN_EVENT_CREATE,
  TEST_DOMAIN_EVENT_SET_STATE,
  TEST_DOMAIN_EVENT_THROWS,
} from "../fixtures/domain-event.fixture";

describe("ViewDomain", () => {
  const logger = createMockLogger();
  const eventHandlers = [
    TEST_VIEW_EVENT_HANDLER,
    TEST_VIEW_EVENT_HANDLER_CREATE,
    TEST_VIEW_EVENT_HANDLER_DESTROY,
    TEST_VIEW_EVENT_HANDLER_MERGE_STATE,
    TEST_VIEW_EVENT_HANDLER_SET_STATE,
    TEST_VIEW_EVENT_HANDLER_THROWS,
  ];

  let domain: IViewDomain;
  let messageBus: IMessageBus;
  let store: any;

  beforeEach(async () => {
    messageBus = createMockMessageBus();
    store = {
      causationExists: jest.fn(),
      clearProcessedCausationIds: jest.fn(),
      load: jest.fn(),
      processCausationIds: jest.fn(),
      save: jest.fn(),
    };

    domain = new ViewDomain({ messageBus, store: store as any }, logger);

    for (const handler of eventHandlers) {
      await domain.registerEventHandler(handler);
    }

    store.causationExists.mockResolvedValue(false);

    store.clearProcessedCausationIds.mockImplementation(
      async (view: View) =>
        new View(
          {
            ...view.toJSON(),
            hash: randomString(16),
            revision: view.revision + 1,
            processedCausationIds: [],
          },
          logger,
        ),
    );

    store.load.mockImplementation(
      async (identifier: ViewIdentifier) => new View(identifier, logger),
    );

    store.processCausationIds.mockResolvedValue(undefined);

    store.save.mockImplementation(
      async (view: View, causation: IMessage) =>
        new View(
          {
            ...view.toJSON(),
            hash: randomString(16),
            revision: view.revision + 1,
            processedCausationIds: [...view.processedCausationIds, causation.id],
          },
          logger,
        ),
    );
  });

  test("should register event handler", async () => {
    messageBus = createMockMessageBus() as unknown as MessageBus;
    domain = new ViewDomain({ messageBus, store: store as any }, logger);

    await expect(domain.registerEventHandler(TEST_VIEW_EVENT_HANDLER)).resolves.toBeUndefined();

    expect(messageBus.subscribe).toHaveBeenCalledWith({
      callback: expect.any(Function),
      queue: "queue.view.default.aggregate_name.domain_event_default.default.name",
      topic: "default.aggregate_name.domain_event_default",
    });
  });

  test("should register multiple event handlers", async () => {
    messageBus = createMockMessageBus() as unknown as MessageBus;
    domain = new ViewDomain({ messageBus, store: store as any }, logger);

    await expect(
      domain.registerEventHandler(
        new ViewEventHandlerImplementation({
          ...TEST_VIEW_EVENT_HANDLER,
          aggregate: {
            ...TEST_VIEW_EVENT_HANDLER.aggregate,
            context: ["one", "two"],
          },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(messageBus.subscribe).toHaveBeenCalledTimes(2);

    expect(messageBus.subscribe).toHaveBeenNthCalledWith(1, {
      callback: expect.any(Function),
      queue: "queue.view.one.aggregate_name.domain_event_default.default.name",
      topic: "one.aggregate_name.domain_event_default",
    });

    expect(messageBus.subscribe).toHaveBeenNthCalledWith(2, {
      callback: expect.any(Function),
      queue: "queue.view.two.aggregate_name.domain_event_default.default.name",
      topic: "two.aggregate_name.domain_event_default",
    });
  });

  test("should throw on existing event handler", async () => {
    domain = new ViewDomain({ messageBus, store: store as any }, logger);

    await domain.registerEventHandler(TEST_VIEW_EVENT_HANDLER);

    await expect(domain.registerEventHandler(TEST_VIEW_EVENT_HANDLER)).rejects.toThrow(
      LindormError,
    );
  });

  test("should throw on invalid event handler", async () => {
    domain = new ViewDomain({ messageBus, store: store as any }, logger);

    await domain.registerEventHandler(TEST_VIEW_EVENT_HANDLER);

    // @ts-ignore
    await expect(domain.registerEventHandler(TEST_AGGREGATE_EVENT_HANDLER)).rejects.toThrow(
      LindormError,
    );
  });

  test("should handle event", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_VIEW_IDENTIFIER)).resolves.toBeUndefined();

    expect(store.load).toHaveBeenCalledWith(
      {
        id: event.aggregate.id,
        context: "default",
        name: "name",
      },
      { type: "memory" },
    );

    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: event.aggregate.id,
        name: "name",
        context: "default",
        processedCausationIds: [],
        destroyed: false,
        revision: 0,
        state: { created: true },
      }),
      event,
      { type: "memory" },
    );
  });

  test("should skip handler when last causation matches event id", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });

    store.load.mockImplementation(
      async (v: ViewIdentifier) =>
        new View(
          {
            ...v,
            revision: 1,
            processedCausationIds: [event.id],
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_VIEW_IDENTIFIER)).resolves.toBeUndefined();

    expect(store.save).not.toHaveBeenCalled();
  });

  test("should throw on missing handler", async () => {
    domain = new ViewDomain({ messageBus, store: store as any }, logger);

    const event = new DomainEvent(TEST_DOMAIN_EVENT);

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_VIEW_IDENTIFIER)).rejects.toThrow(
      HandlerNotRegisteredError,
    );
  });

  test("should dispatch error on destroyed view", async () => {
    const event = new DomainEvent(TEST_DOMAIN_EVENT);

    store.load.mockImplementation(
      async (v: ViewIdentifier) =>
        new View(
          {
            ...v,
            destroyed: true,
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_VIEW_IDENTIFIER)).resolves.toBeUndefined();

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "view_destroyed_error",
        data: {
          error: expect.any(ViewDestroyedError),
          message: event,
          view: {
            id: expect.any(String),
            name: "name",
            context: "default",
          },
        },
      }),
    ]);
  });

  test("should throw on not created view", async () => {
    const event = new DomainEvent(TEST_DOMAIN_EVENT_SET_STATE);

    store.load.mockImplementation(
      async (v: ViewIdentifier) =>
        new View(
          {
            ...v,
            revision: 0,
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_VIEW_IDENTIFIER)).rejects.toThrow(
      ViewNotCreatedError,
    );

    expect(messageBus.publish).not.toHaveBeenCalled();
  });

  test("should dispatch error on not created view", async () => {
    domain = new ViewDomain({ messageBus, store: store as any }, logger);

    await domain.registerEventHandler(
      new ViewEventHandlerImplementation({
        ...TEST_VIEW_EVENT_HANDLER_SET_STATE,
        conditions: {
          created: true,
          permanent: true,
        },
      }),
    );

    const event = new DomainEvent(TEST_DOMAIN_EVENT_SET_STATE);

    store.load.mockImplementation(
      async (v: ViewIdentifier) =>
        new View(
          {
            ...v,
            revision: 0,
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_VIEW_IDENTIFIER)).resolves.toBeUndefined();

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "view_not_created_error",
        data: {
          error: expect.any(ViewNotCreatedError),
          message: event,
          view: {
            id: expect.any(String),
            name: "name",
            context: "default",
          },
        },
      }),
    ]);
  });

  test("should throw on already created view", async () => {
    domain = new ViewDomain({ messageBus, store: store as any }, logger);

    await domain.registerEventHandler(
      new ViewEventHandlerImplementation({
        ...TEST_VIEW_EVENT_HANDLER_CREATE,
        conditions: {
          created: false,
          permanent: false,
        },
      }),
    );

    const event = new DomainEvent(TEST_DOMAIN_EVENT_CREATE);

    store.load.mockImplementation(
      async (v: ViewIdentifier) =>
        new View(
          {
            ...v,
            revision: 1,
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_VIEW_IDENTIFIER)).rejects.toThrow(
      ViewAlreadyCreatedError,
    );

    expect(messageBus.publish).not.toHaveBeenCalled();
  });

  test("should dispatch error on already created view", async () => {
    const event = new DomainEvent(TEST_DOMAIN_EVENT_CREATE);

    store.load.mockImplementation(
      async (v: ViewIdentifier) =>
        new View(
          {
            ...v,
            revision: 1,
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_VIEW_IDENTIFIER)).resolves.toBeUndefined();

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "view_already_created_error",
        data: {
          error: expect.any(ViewAlreadyCreatedError),
          message: event,
          view: {
            id: expect.any(String),
            name: "name",
            context: "default",
          },
        },
      }),
    ]);
  });

  test("should throw from event handler", async () => {
    const event = new DomainEvent(TEST_DOMAIN_EVENT_THROWS);

    store.load.mockImplementation(
      async (v: ViewIdentifier) =>
        new View(
          {
            ...v,
            revision: 1,
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_VIEW_IDENTIFIER)).rejects.toThrow(
      new Error("throw"),
    );

    expect(messageBus.publish).not.toHaveBeenCalled();
  });
});
