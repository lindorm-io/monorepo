import { Cache } from "../entity";
import { CacheDomain } from "./CacheDomain";
import { CacheEventHandler } from "../handler";
import { CacheIdentifier } from "../types";
import { DomainEvent, Message } from "../message";
import { LindormError } from "@lindorm-io/errors";
import { MessageBus } from "../infrastructure";
import { TEST_AGGREGATE_EVENT_HANDLER } from "../fixtures/aggregate-event-handler.fixture";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import { TEST_CACHE_IDENTIFIER } from "../fixtures/cache.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import { createMockMessageBus } from "@lindorm-io/amqp";
import { randomUUID } from "crypto";
import {
  CacheAlreadyCreatedError,
  CacheDestroyedError,
  CacheNotCreatedError,
  HandlerNotRegisteredError,
} from "../error";
import {
  TEST_CACHE_EVENT_HANDLER,
  TEST_CACHE_EVENT_HANDLER_ADD_FIELD,
  TEST_CACHE_EVENT_HANDLER_CREATE,
  TEST_CACHE_EVENT_HANDLER_DESTROY,
  TEST_CACHE_EVENT_HANDLER_REMOVE_FIELD_WHERE_EQUAL,
  TEST_CACHE_EVENT_HANDLER_REMOVE_FIELD_WHERE_MATCH,
  TEST_CACHE_EVENT_HANDLER_SET_STATE,
  TEST_CACHE_EVENT_HANDLER_THROWS,
} from "../fixtures/cache-event-handler.fixture";
import {
  TEST_DOMAIN_EVENT,
  TEST_DOMAIN_EVENT_CREATE,
  TEST_DOMAIN_EVENT_SET_STATE,
  TEST_DOMAIN_EVENT_THROWS,
} from "../fixtures/domain-event.fixture";

describe("CacheDomain", () => {
  const logger = createMockLogger();
  const eventHandlers = [
    TEST_CACHE_EVENT_HANDLER,
    TEST_CACHE_EVENT_HANDLER_ADD_FIELD,
    TEST_CACHE_EVENT_HANDLER_CREATE,
    TEST_CACHE_EVENT_HANDLER_DESTROY,
    TEST_CACHE_EVENT_HANDLER_REMOVE_FIELD_WHERE_EQUAL,
    TEST_CACHE_EVENT_HANDLER_REMOVE_FIELD_WHERE_MATCH,
    TEST_CACHE_EVENT_HANDLER_SET_STATE,
    TEST_CACHE_EVENT_HANDLER_THROWS,
  ];

  let domain: CacheDomain;
  let messageBus: MessageBus;
  let store: any;

  beforeEach(async () => {
    messageBus = createMockMessageBus();
    store = {
      save: jest.fn(),
      load: jest.fn(),
    };

    domain = new CacheDomain({ logger, messageBus, store: store as any });

    for (const handler of eventHandlers) {
      await domain.registerEventHandler(handler);
    }

    store.save.mockImplementation(
      async (cache: Cache, causation: Message) =>
        new Cache(
          {
            ...cache.toJSON(),
            revision: cache.revision + 1,
            causationList: [...cache.causationList, causation.id],
          },
          logger,
        ),
    );

    store.load.mockImplementation(async (v: CacheIdentifier) => new Cache(v, logger));
  });

  test("should register event handler", async () => {
    messageBus = createMockMessageBus();
    domain = new CacheDomain({ logger, messageBus, store: store as any });

    await expect(domain.registerEventHandler(TEST_CACHE_EVENT_HANDLER)).resolves.toBeUndefined();

    expect(messageBus.subscribe).toHaveBeenCalledWith({
      callback: expect.any(Function),
      queue: "queue.cache.default.aggregate_name.domain_event_default.default.cache_name",
      routingKey: "default.aggregate_name.domain_event_default",
    });
  });

  test("should register multiple event handlers", async () => {
    messageBus = createMockMessageBus();
    domain = new CacheDomain({ logger, messageBus, store: store as any });

    await expect(
      domain.registerEventHandler(
        new CacheEventHandler({
          ...TEST_CACHE_EVENT_HANDLER,
          aggregate: {
            ...TEST_CACHE_EVENT_HANDLER.aggregate,
            context: ["one", "two"],
          },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(messageBus.subscribe).toHaveBeenCalledTimes(2);

    expect(messageBus.subscribe).toHaveBeenNthCalledWith(1, {
      callback: expect.any(Function),
      queue: "queue.cache.one.aggregate_name.domain_event_default.default.cache_name",
      routingKey: "one.aggregate_name.domain_event_default",
    });

    expect(messageBus.subscribe).toHaveBeenNthCalledWith(2, {
      callback: expect.any(Function),
      queue: "queue.cache.two.aggregate_name.domain_event_default.default.cache_name",
      routingKey: "two.aggregate_name.domain_event_default",
    });
  });

  test("should throw on existing event handler", async () => {
    domain = new CacheDomain({ logger, messageBus, store: store as any });

    await domain.registerEventHandler(TEST_CACHE_EVENT_HANDLER);

    await expect(domain.registerEventHandler(TEST_CACHE_EVENT_HANDLER)).rejects.toThrow(
      LindormError,
    );
  });

  test("should throw on invalid event handler", async () => {
    domain = new CacheDomain({ logger, messageBus, store: store as any });

    await domain.registerEventHandler(TEST_CACHE_EVENT_HANDLER);

    // @ts-ignore
    await expect(domain.registerEventHandler(TEST_AGGREGATE_EVENT_HANDLER)).rejects.toThrow(
      LindormError,
    );
  });

  test("should handle event", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_CACHE_IDENTIFIER)).resolves.toBeUndefined();

    expect(store.load).toHaveBeenCalledWith({
      id: event.aggregate.id,
      context: "default",
      name: "cache_name",
    });

    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: event.aggregate.id,
        name: "cache_name",
        context: "default",
        causationList: [],
        destroyed: false,
        meta: { created: { removed: false, timestamp: expect.any(Date), value: true } },
        revision: 0,
        state: { created: true },
      }),
      event,
    );
  });

  test("should skip handler when last causation matches event id", async () => {
    const aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });

    store.load.mockImplementation(
      async (v: CacheIdentifier) =>
        new Cache(
          {
            ...v,
            revision: 1,
            causationList: [event.id],
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_CACHE_IDENTIFIER)).resolves.toBeUndefined();

    expect(store.save).not.toHaveBeenCalled();
  });

  test("should throw on missing handler", async () => {
    domain = new CacheDomain({ logger, messageBus, store: store as any });

    const event = new DomainEvent(TEST_DOMAIN_EVENT);

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_CACHE_IDENTIFIER)).rejects.toThrow(
      HandlerNotRegisteredError,
    );
  });

  test("should dispatch error on destroyed cache", async () => {
    const event = new DomainEvent(TEST_DOMAIN_EVENT);

    store.load.mockImplementation(
      async (v: CacheIdentifier) =>
        new Cache(
          {
            ...v,
            destroyed: true,
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_CACHE_IDENTIFIER)).resolves.toBeUndefined();

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "CacheDestroyedError",
        data: {
          error: expect.any(CacheDestroyedError),
          message: event,
        },
      }),
    ]);
  });

  test("should throw on not created cache", async () => {
    const event = new DomainEvent(TEST_DOMAIN_EVENT_SET_STATE);

    store.load.mockImplementation(
      async (v: CacheIdentifier) =>
        new Cache(
          {
            ...v,
            revision: 0,
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_CACHE_IDENTIFIER)).rejects.toThrow(
      CacheNotCreatedError,
    );

    expect(messageBus.publish).not.toHaveBeenCalled();
  });

  test("should dispatch error on not created cache", async () => {
    domain = new CacheDomain({ logger, messageBus, store: store as any });

    await domain.registerEventHandler(
      new CacheEventHandler({
        ...TEST_CACHE_EVENT_HANDLER_SET_STATE,
        conditions: {
          created: true,
          permanent: true,
        },
      }),
    );

    const event = new DomainEvent(TEST_DOMAIN_EVENT_SET_STATE);

    store.load.mockImplementation(
      async (v: CacheIdentifier) =>
        new Cache(
          {
            ...v,
            revision: 0,
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_CACHE_IDENTIFIER)).resolves.toBeUndefined();

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "CacheNotCreatedError",
        data: {
          error: expect.any(CacheNotCreatedError),
          message: event,
        },
      }),
    ]);
  });

  test("should throw on already created cache", async () => {
    domain = new CacheDomain({ logger, messageBus, store: store as any });

    await domain.registerEventHandler(
      new CacheEventHandler({
        ...TEST_CACHE_EVENT_HANDLER_CREATE,
        conditions: {
          created: false,
          permanent: false,
        },
      }),
    );

    const event = new DomainEvent(TEST_DOMAIN_EVENT_CREATE);

    store.load.mockImplementation(
      async (v: CacheIdentifier) =>
        new Cache(
          {
            ...v,
            revision: 1,
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_CACHE_IDENTIFIER)).rejects.toThrow(
      CacheAlreadyCreatedError,
    );

    expect(messageBus.publish).not.toHaveBeenCalled();
  });

  test("should dispatch error on already created cache", async () => {
    const event = new DomainEvent(TEST_DOMAIN_EVENT_CREATE);

    store.load.mockImplementation(
      async (v: CacheIdentifier) =>
        new Cache(
          {
            ...v,
            revision: 1,
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_CACHE_IDENTIFIER)).resolves.toBeUndefined();

    expect(messageBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "CacheAlreadyCreatedError",
        data: {
          error: expect.any(CacheAlreadyCreatedError),
          message: event,
        },
      }),
    ]);
  });

  test("should throw from event handler", async () => {
    const event = new DomainEvent(TEST_DOMAIN_EVENT_THROWS);

    store.load.mockImplementation(
      async (v: CacheIdentifier) =>
        new Cache(
          {
            ...v,
            revision: 1,
          },
          logger,
        ),
    );

    // @ts-ignore // private domain.handleEvent
    await expect(domain.handleEvent(event, TEST_CACHE_IDENTIFIER)).rejects.toThrow(
      new Error("throw"),
    );

    expect(messageBus.publish).not.toHaveBeenCalled();
  });
});
