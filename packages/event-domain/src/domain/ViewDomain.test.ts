import { DomainEvent, Message } from "../message";
import { LindormError } from "@lindorm-io/errors";
import { MessageBus } from "../infrastructure";
import { TEST_AGGREGATE_EVENT_HANDLER } from "../fixtures/aggregate-event-handler.fixture";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import { TEST_VIEW_IDENTIFIER } from "../fixtures/view.fixture";
import { View } from "../entity";
import { ViewDomain } from "./ViewDomain";
import { ViewEventHandler } from "../handler";
import { ViewIdentifier } from "../types";
import { createMockLogger } from "@lindorm-io/winston";
import { createMockMessageBus } from "@lindorm-io/amqp";
import { randomUUID } from "crypto";
import {
  HandlerNotRegisteredError,
  ViewAlreadyCreatedError,
  ViewDestroyedError,
  ViewNotCreatedError,
} from "../error";
import {
  TEST_VIEW_EVENT_HANDLER,
  TEST_VIEW_EVENT_HANDLER_ADD_FIELD,
  TEST_VIEW_EVENT_HANDLER_CREATE,
  TEST_VIEW_EVENT_HANDLER_DESTROY,
  TEST_VIEW_EVENT_HANDLER_REMOVE_FIELD_WHERE_EQUAL,
  TEST_VIEW_EVENT_HANDLER_REMOVE_FIELD_WHERE_MATCH,
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
    TEST_VIEW_EVENT_HANDLER_ADD_FIELD,
    TEST_VIEW_EVENT_HANDLER_CREATE,
    TEST_VIEW_EVENT_HANDLER_DESTROY,
    TEST_VIEW_EVENT_HANDLER_REMOVE_FIELD_WHERE_EQUAL,
    TEST_VIEW_EVENT_HANDLER_REMOVE_FIELD_WHERE_MATCH,
    TEST_VIEW_EVENT_HANDLER_SET_STATE,
    TEST_VIEW_EVENT_HANDLER_THROWS,
  ];

  let domain: ViewDomain;
  let messageBus: MessageBus;
  let store: any;

  beforeEach(async () => {
    messageBus = createMockMessageBus();
    store = {
      save: jest.fn(),
      load: jest.fn(),
      query: jest.fn(),
    };

    domain = new ViewDomain({ logger, messageBus, store: store as any });

    for (const handler of eventHandlers) {
      await domain.registerEventHandler(handler);
    }

    store.save.mockImplementation(
      async (view: View, causation: Message) =>
        new View(
          {
            ...view.toJSON(),
            revision: view.revision + 1,
            causationList: [...view.causationList, causation.id],
          },
          logger,
        ),
    );

    store.load.mockImplementation(async (v: ViewIdentifier) => new View(v, logger));

    store.query.mockImplementation(async (filter: any, queryOptions: any, findOptions: any) => [
      {
        filter,
        queryOptions,
        findOptions,
      },
    ]);
  });

  test("should register event handler", async () => {
    messageBus = createMockMessageBus();
    domain = new ViewDomain({ logger, messageBus, store: store as any });

    await expect(domain.registerEventHandler(TEST_VIEW_EVENT_HANDLER)).resolves.toBeUndefined();

    expect(messageBus.subscribe).toHaveBeenCalledWith({
      callback: expect.any(Function),
      queue: "queue.view.default.aggregate_name.domain_event_default.default.view_name",
      routingKey: "default.aggregate_name.domain_event_default",
    });
  });

  test("should register multiple event handlers", async () => {
    messageBus = createMockMessageBus();
    domain = new ViewDomain({ logger, messageBus, store: store as any });

    await expect(
      domain.registerEventHandler(
        new ViewEventHandler({
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
      queue: "queue.view.one.aggregate_name.domain_event_default.default.view_name",
      routingKey: "one.aggregate_name.domain_event_default",
    });

    expect(messageBus.subscribe).toHaveBeenNthCalledWith(2, {
      callback: expect.any(Function),
      queue: "queue.view.two.aggregate_name.domain_event_default.default.view_name",
      routingKey: "two.aggregate_name.domain_event_default",
    });
  });

  test("should throw on existing event handler", async () => {
    domain = new ViewDomain({ logger, messageBus, store: store as any });

    await domain.registerEventHandler(TEST_VIEW_EVENT_HANDLER);

    await expect(domain.registerEventHandler(TEST_VIEW_EVENT_HANDLER)).rejects.toThrow(
      LindormError,
    );
  });

  test("should throw on invalid event handler", async () => {
    domain = new ViewDomain({ logger, messageBus, store: store as any });

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
        name: "view_name",
      },
      {},
    );

    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: event.aggregate.id,
        name: "view_name",
        context: "default",
        causationList: [],
        destroyed: false,
        meta: { created: { removed: false, timestamp: expect.any(Date), value: true } },
        revision: 0,
        state: { created: true },
      }),
      event,
      {},
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
            causationList: [event.id],
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_VIEW_IDENTIFIER)).resolves.toBeUndefined();

    expect(store.save).not.toHaveBeenCalled();
  });

  test("should throw on missing handler", async () => {
    domain = new ViewDomain({ logger, messageBus, store: store as any });

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
        name: "ViewDestroyedError",
        data: {
          error: expect.any(ViewDestroyedError),
          message: event,
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
    domain = new ViewDomain({ logger, messageBus, store: store as any });

    await domain.registerEventHandler(
      new ViewEventHandler({
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
        name: "ViewNotCreatedError",
        data: {
          error: expect.any(ViewNotCreatedError),
          message: event,
        },
      }),
    ]);
  });

  test("should throw on already created view", async () => {
    domain = new ViewDomain({ logger, messageBus, store: store as any });

    await domain.registerEventHandler(
      new ViewEventHandler({
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
        name: "ViewAlreadyCreatedError",
        data: {
          error: expect.any(ViewAlreadyCreatedError),
          message: event,
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
