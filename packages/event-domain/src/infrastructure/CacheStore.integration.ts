import { AggregateIdentifier, CacheIdentifier } from "../types";
import { Cache } from "../entity";
import { CacheStore } from "./CacheStore";
import { DomainEvent } from "../message";
import { RedisConnection } from "@lindorm-io/redis";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import { TEST_CACHE_IDENTIFIER } from "../fixtures/cache.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import {
  TEST_DOMAIN_EVENT_CREATE,
  TEST_DOMAIN_EVENT_SET_STATE,
} from "../fixtures/domain-event.fixture";

describe("CacheStore", () => {
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let connection: RedisConnection;
  let store: CacheStore;
  let cache: CacheIdentifier;

  beforeAll(async () => {
    connection = new RedisConnection({
      host: "localhost",
      port: 6371,
      logger,
    });

    store = new CacheStore({ connection, logger });

    await connection.connect();
  }, 30000);

  beforeEach(() => {
    aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    cache = { ...TEST_CACHE_IDENTIFIER, id: aggregate.id };
  });

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should save new cache", async () => {
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });
    const entity = new Cache(cache, logger);

    await expect(store.save(entity, event)).resolves.toStrictEqual(
      expect.objectContaining({
        id: cache.id,
        name: "cacheName",
        context: "cacheContext",
        causationList: [event.id],
        destroyed: false,
        meta: {},
        revision: 1,
        state: {},
      }),
    );
  }, 10000);

  test("should save existing cache", async () => {
    const event1 = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });
    const entity = new Cache(
      {
        ...cache,
        state: {
          created: true,
        },
      },
      logger,
    );

    const saved = await store.save(entity, event1);
    const event2 = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });
    const changed = new Cache(
      {
        ...saved.toJSON(),
        state: {
          ...saved.toJSON().state,
          changed: true,
        },
      },
      logger,
    );

    await expect(store.save(changed, event2)).resolves.toStrictEqual(
      expect.objectContaining({
        id: cache.id,
        name: "cacheName",
        context: "cacheContext",
        causationList: [event1.id, event2.id],
        destroyed: false,
        meta: {},
        revision: 2,
        state: {
          created: true,
          changed: true,
        },
      }),
    );
  }, 10000);

  test("should load new cache", async () => {
    await expect(store.load(cache)).resolves.toStrictEqual(
      expect.objectContaining({
        id: cache.id,
        name: "cacheName",
        context: "cacheContext",
        causationList: [],
        destroyed: false,
        meta: {},
        revision: 0,
        state: {},
      }),
    );
  });

  test("should load existing cache", async () => {
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_CREATE, aggregate });
    const entity = new Cache({ ...cache, state: { created: true } }, logger);

    await store.save(entity, event);

    await expect(store.load(cache)).resolves.toStrictEqual(
      expect.objectContaining({
        id: cache.id,
        name: "cacheName",
        context: "cacheContext",
        causationList: [event.id],
        destroyed: false,
        meta: {},
        revision: 1,
        state: { created: true },
      }),
    );
  });
});
