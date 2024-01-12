import { createMockLogger } from "@lindorm-io/core-logger";
import { MemoryDatabase } from "@lindorm-io/in-memory-cache";
import {
  StoredKeySet,
  createTestStoredKeySetEc,
  createTestStoredKeySetRsa,
} from "@lindorm-io/keystore";
import { KoaApp } from "@lindorm-io/koa";
import { StoredKeySetMemoryCache, StoredKeySetRedisRepository } from "@lindorm-io/koa-keystore";
import { RedisConnection } from "@lindorm-io/redis";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import request from "supertest";
import { createNodeServer } from "../util/create-node-server";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("/.well-known", () => {
  let server: KoaApp;
  let ecKey: StoredKeySet;
  let rsaKey: StoredKeySet;

  beforeAll(async () => {
    const logger = createMockLogger();

    const redisConnection = new RedisConnection(
      {
        host: "localhost",
        port: 5009,
      },
      logger,
    );

    const memoryDatabase = new MemoryDatabase();

    server = createNodeServer({
      host: "http://localhost",
      logger,
      keystore: {
        exportKeys: "both",
        storage: ["memory", "redis"],
      },
      memoryDatabase,
      port: 3000,
      redisConnection,
    });

    const storedKeySetRedis = new StoredKeySetRedisRepository(redisConnection, logger);
    ecKey = await storedKeySetRedis.create(createTestStoredKeySetEc({ id: randomUUID() }));

    const storedKeySetMemory = new StoredKeySetMemoryCache(memoryDatabase, logger);
    rsaKey = await storedKeySetMemory.create(createTestStoredKeySetRsa({ id: randomUUID() }));
  });

  test("GET /jwks.json", async () => {
    const response = await request(server.callback()).get("/.well-known/jwks.json").expect(200);

    expect(response.body).toStrictEqual({
      keys: expect.arrayContaining([
        expect.objectContaining(ecKey.webKeySet.jwk()),
        expect.objectContaining(rsaKey.webKeySet.jwk()),
      ]),
    });
  });
});
