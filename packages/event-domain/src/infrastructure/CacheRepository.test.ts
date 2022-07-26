import RedisMock from "ioredis-mock";
import { CacheIdentifier, HandlerIdentifier } from "../types";
import { CacheRepository } from "./CacheRepository";
import { Redis } from "ioredis";
import { RedisConnection } from "@lindorm-io/redis";
import { TEST_CACHE_IDENTIFIER } from "../fixtures/cache.fixture";
import { createMockLogger } from "@lindorm-io/winston";
import { randomUUID } from "crypto";
import { snakeCase } from "lodash";
import { stringifyBlob } from "@lindorm-io/string-blob";

const getKey = (identifier: CacheIdentifier): string =>
  `${snakeCase(identifier.context)}::${snakeCase(identifier.name)}::item::${identifier.id}`;

const getIndex = (identifier: HandlerIdentifier): string =>
  `${snakeCase(identifier.context)}::${snakeCase(identifier.name)}::index`;

describe("CacheRepository", () => {
  const logger = createMockLogger();

  let connection: RedisConnection;
  let repository: CacheRepository;
  let cache: CacheIdentifier;

  let cache1: string;
  let cache2: string;
  let cache3: string;

  beforeAll(async () => {
    connection = new RedisConnection({
      host: "localhost",
      port: 6371,
      logger,
      custom: new RedisMock({
        host: "localhost",
        port: 6371,
      }) as unknown as Redis,
    });

    cache = { ...TEST_CACHE_IDENTIFIER, id: randomUUID() };

    repository = new CacheRepository({
      connection,
      logger,
      cache: {
        name: cache.name,
        context: cache.context,
      },
    });

    await connection.connect();

    cache1 = randomUUID();
    cache2 = randomUUID();
    cache3 = randomUUID();

    const destroyed = randomUUID();

    await connection.client.set(
      getKey({ ...cache, id: cache1 }),
      stringifyBlob({
        id: cache1,
        name: cache.name,
        context: cache.context,
        causationList: [],
        destroyed: false,
        meta: {},
        revision: 1,
        state: { one: 1 },
        timeModified: new Date(),
        timestamp: new Date(),
      }),
    );
    await connection.client.set(
      getKey({ ...cache, id: cache2 }),
      stringifyBlob({
        id: cache2,
        name: cache.name,
        context: cache.context,
        causationList: [],
        destroyed: false,
        meta: {},
        revision: 2,
        state: { two: 2 },
        timeModified: new Date(),
        timestamp: new Date(),
      }),
    );
    await connection.client.set(
      getKey({ ...cache, id: cache3 }),
      stringifyBlob({
        id: cache3,
        name: cache.name,
        context: cache.context,
        causationList: [],
        destroyed: false,
        meta: {},
        revision: 3,
        state: { three: 3 },
        timeModified: new Date(),
        timestamp: new Date(),
      }),
    );
    await connection.client.set(
      getKey({ ...cache, id: destroyed }),
      stringifyBlob({
        id: randomUUID(),
        name: cache.name,
        context: cache.context,
        causationList: [],
        destroyed: true,
        meta: {},
        revision: 4,
        state: { four: 4 },
        timeModified: new Date(),
        timestamp: new Date(),
      }),
    );

    await connection.client.set(
      getIndex(cache),
      JSON.stringify([cache1, cache2, cache3, destroyed]),
    );
  }, 30000);

  afterAll(async () => {
    await connection.disconnect();
  });

  test("should resolve array of cache data", async () => {
    await expect(repository.getAll()).resolves.toStrictEqual([
      {
        id: cache1,
        revision: 1,
        state: { one: 1 },
      },
      {
        id: cache2,
        revision: 2,
        state: { two: 2 },
      },
      {
        id: cache3,
        revision: 3,
        state: { three: 3 },
      },
    ]);
  });

  test("should resolve specific cache data", async () => {
    await expect(repository.get(cache1)).resolves.toStrictEqual({
      id: cache1,
      revision: 1,
      state: { one: 1 },
    });
  });
});
