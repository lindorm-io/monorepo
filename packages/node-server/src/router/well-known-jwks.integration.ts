import MockDate from "mockdate";
import request from "supertest";
import { KeyPairMemoryCache, KeyPairRedisRepository } from "@lindorm-io/koa-keystore";
import { KoaApp } from "@lindorm-io/koa";
import { MemoryDatabase } from "@lindorm-io/in-memory-cache";
import { RedisConnection } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/core-logger";
import { createNodeServer } from "../util/create-node-server";
import { createTestKeyPairEC, createTestKeyPairRSA } from "@lindorm-io/key-pair";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("/.well-known", () => {
  let server: KoaApp;

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
        exposed: ["public"],
        storage: ["memory", "redis"],
      },
      memoryDatabase,
      port: 3000,
      redisConnection,
    });

    const keyPairRedis = new KeyPairRedisRepository(redisConnection, logger);
    await keyPairRedis.create(createTestKeyPairEC());

    const keyPairMemory = new KeyPairMemoryCache(memoryDatabase, logger);
    await keyPairMemory.create(createTestKeyPairRSA());
  });

  test("GET /jwks.json", async () => {
    const response = await request(server.callback()).get("/.well-known/jwks.json").expect(200);

    expect(response.body).toStrictEqual({
      keys: [
        {
          alg: "RS512",
          allowed_from: 1577865600,
          created_at: 1577865600,
          e: "AQAB",
          expires_at: 1861948800,
          key_ops: ["decrypt", "verify"],
          kid: expect.any(String),
          kty: "RSA",
          n: "ylo2AV+CdQg0p3HLGOVmzcvQYGNxbuqrC3MEAAyB0lZwSjtnx+UM0bKu+XwZqsve2TCgFylTKLX9rDIekd5ExIuAo6fAx4x6cr31PN5ThRY9f1lchDgrFYS1ZZ+tbIJyQdMOAYP+C+kznKCQduGu7ye7Skxk0jU3kZblsyCZfW0=",
          use: "sig",
        },
        {
          alg: "ES512",
          allowed_from: 1577865600,
          created_at: 1577865600,
          crv: "P-521",
          expires_at: 1861948800,
          key_ops: ["verify"],
          kid: expect.any(String),
          kty: "EC",
          use: "sig",
          x: "AHxwF8PAKLjUbiRVbhXdjzqcgwwLKljN87yBiOlLT3WXGQyChNFLcszWnrkpB/AGiWtYh1Wtts4gsBJ/Tp9CwfDm",
          y: "AS3iydW4wE74tLql6xf28DxBPUuNfvlerYiectjVVOh42bGS4z6gNmCoc5jDN9SG77NloDkC4SSo+LjtMD2IJJhV",
        },
      ],
    });
  });
});
