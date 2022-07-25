import { AggregateIdentifier, CacheIdentifier } from "../types";
import { Cache } from "../entity";
import { CacheNotUpdatedError } from "../error";
import { CacheStore } from "./CacheStore";
import { DomainEvent } from "../message";
import { TEST_AGGREGATE_IDENTIFIER } from "../fixtures/aggregate.fixture";
import { TEST_CACHE_IDENTIFIER } from "../fixtures/cache.fixture";
import { TEST_DOMAIN_EVENT_SET_STATE } from "../fixtures/domain-event.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import { createMockRedisConnection } from "@lindorm-io/redis";
import { randomUUID } from "crypto";
import { stringifyBlob } from "@lindorm-io/string-blob";

describe("CacheStore", () => {
  const logger = createMockLogger();

  let aggregate: AggregateIdentifier;
  let connection: any;
  let store: CacheStore;
  let cache: CacheIdentifier;

  let getSpy: jest.Mock;
  let setSpy: jest.Mock;

  beforeEach(async () => {
    getSpy = jest.fn().mockResolvedValue(null);
    setSpy = jest.fn().mockResolvedValue("OK");

    connection = createMockRedisConnection({ get: getSpy, set: setSpy });

    aggregate = { ...TEST_AGGREGATE_IDENTIFIER, id: randomUUID() };
    cache = { ...TEST_CACHE_IDENTIFIER, id: aggregate.id };

    store = new CacheStore({ connection, logger });
  }, 30000);

  test("should return existing cache", async () => {
    const entity = new Cache(cache, logger);
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });

    getSpy.mockResolvedValueOnce(
      stringifyBlob({
        ...cache,
        causationList: ["d2679fa3-5fa4-4911-9e63-4ee094fcaa5a", event.id],
        destroyed: false,
        meta: {},
        revision: 2,
        state: { loadedState: true },
      }),
    );

    await expect(store.save(entity, event)).resolves.toStrictEqual(
      expect.objectContaining({
        id: cache.id,
        name: "cacheName",
        context: "cacheContext",
        causationList: ["d2679fa3-5fa4-4911-9e63-4ee094fcaa5a", event.id],
        destroyed: false,
        meta: {},
        revision: 2,
        state: { loadedState: true },
      }),
    );

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).not.toHaveBeenCalled();
  });

  test("should save new cache", async () => {
    const entity = new Cache(cache, logger);
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });

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

    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(setSpy).toHaveBeenCalledTimes(2);

    expect(getSpy).toHaveBeenNthCalledWith(1, `cache_context::cache_name::item::${cache.id}`);
    expect(getSpy).toHaveBeenNthCalledWith(2, "cache_context::cache_name::index");

    expect(setSpy).toHaveBeenNthCalledWith(
      1,
      `cache_context::cache_name::item::${cache.id}`,
      expect.any(String),
    );
    expect(setSpy).toHaveBeenNthCalledWith(
      2,
      "cache_context::cache_name::index",
      JSON.stringify([cache.id]),
    );
  });

  test("should update existing cache", async () => {
    const entity = new Cache(
      {
        ...cache,
        causationList: [
          "012db886-5a2b-4f41-8c45-6cf7eb64307d",
          "6bd7ffa6-56c1-40b1-986e-cc919671e164",
        ],
        revision: 2,
        state: { created: true, updated: true, value: "one" },
      },
      logger,
    );
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });

    getSpy.mockResolvedValue(
      stringifyBlob({
        ...cache,
        causationList: [
          "012db886-5a2b-4f41-8c45-6cf7eb64307d",
          "6bd7ffa6-56c1-40b1-986e-cc919671e164",
        ],
        revision: 2,
        state: { created: true, updated: true },
      }),
    );

    await expect(store.save(entity, event)).resolves.toStrictEqual(
      expect.objectContaining({
        id: cache.id,
        name: "cacheName",
        context: "cacheContext",
        causationList: [
          "012db886-5a2b-4f41-8c45-6cf7eb64307d",
          "6bd7ffa6-56c1-40b1-986e-cc919671e164",
          event.id,
        ],
        destroyed: false,
        meta: {},
        revision: 3,
        state: { created: true, updated: true, value: "one" },
      }),
    );

    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(setSpy).toHaveBeenCalledTimes(1);
  });

  test("should load existing cache", async () => {
    getSpy.mockResolvedValue(
      stringifyBlob({
        ...cache,
        causationList: ["d2679fa3-5fa4-4911-9e63-4ee094fcaa5a"],
        destroyed: false,
        meta: {},
        revision: 2,
        state: { loadedState: true },
      }),
    );

    await expect(store.load(cache)).resolves.toStrictEqual(
      expect.objectContaining({
        id: cache.id,
        name: "cacheName",
        context: "cacheContext",
        causationList: ["d2679fa3-5fa4-4911-9e63-4ee094fcaa5a"],
        destroyed: false,
        meta: {},
        revision: 2,
        state: { loadedState: true },
      }),
    );
  });

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

  test("should throw on failed update", async () => {
    const entity = new Cache(
      {
        ...cache,
        causationList: ["012db886-5a2b-4f41-8c45-6cf7eb64307d"],
        revision: 2,
        state: { created: true, updated: true },
      },
      logger,
    );
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });

    getSpy.mockResolvedValue(
      stringifyBlob({
        ...cache,
        causationList: ["012db886-5a2b-4f41-8c45-6cf7eb64307d"],
        revision: 2,
        state: { created: true },
      }),
    );

    setSpy.mockResolvedValueOnce(null);

    await expect(store.save(entity, event)).rejects.toThrow(CacheNotUpdatedError);
  });

  test("should throw on document not found", async () => {
    const entity = new Cache(
      {
        ...cache,
        causationList: ["012db886-5a2b-4f41-8c45-6cf7eb64307d"],
        revision: 2,
        state: { created: true, updated: true },
      },
      logger,
    );
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });

    getSpy.mockResolvedValueOnce(
      stringifyBlob({
        ...cache,
        causationList: ["012db886-5a2b-4f41-8c45-6cf7eb64307d"],
        revision: 2,
        state: { created: true },
      }),
    );

    await expect(store.save(entity, event)).rejects.toThrow(CacheNotUpdatedError);
  });

  test("should throw on invalid document revision", async () => {
    const entity = new Cache(
      {
        ...cache,
        causationList: ["012db886-5a2b-4f41-8c45-6cf7eb64307d"],
        revision: 2,
        state: { created: true, updated: true },
      },
      logger,
    );
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });

    getSpy
      .mockResolvedValueOnce(
        stringifyBlob({
          ...cache,
          causationList: ["012db886-5a2b-4f41-8c45-6cf7eb64307d"],
          revision: 2,
          state: { created: true },
        }),
      )
      .mockResolvedValueOnce(
        stringifyBlob({
          ...cache,
          causationList: ["012db886-5a2b-4f41-8c45-6cf7eb64307d"],
          revision: 3,
          state: { created: true, other: "update" },
        }),
      );

    await expect(store.save(entity, event)).rejects.toThrow(CacheNotUpdatedError);
  });

  test("should throw on invalid document causation list", async () => {
    const entity = new Cache(
      {
        ...cache,
        causationList: ["012db886-5a2b-4f41-8c45-6cf7eb64307d"],
        revision: 2,
        state: { created: true, updated: true },
      },
      logger,
    );
    const event = new DomainEvent({ ...TEST_DOMAIN_EVENT_SET_STATE, aggregate });

    getSpy
      .mockResolvedValueOnce(
        stringifyBlob({
          ...cache,
          causationList: ["012db886-5a2b-4f41-8c45-6cf7eb64307d"],
          revision: 2,
          state: { created: true },
        }),
      )
      .mockResolvedValueOnce(
        stringifyBlob({
          ...cache,
          causationList: ["5acc016e-310f-4254-b1de-9a86367681c3"],
          revision: 2,
          state: { created: true, strange: "causation" },
        }),
      );

    await expect(store.save(entity, event)).rejects.toThrow(CacheNotUpdatedError);
  });
});
