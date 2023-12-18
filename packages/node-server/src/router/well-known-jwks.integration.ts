import { createMockLogger } from "@lindorm-io/core-logger";
import { MemoryDatabase } from "@lindorm-io/in-memory-cache";
import { createTestKeyPairEC, createTestKeyPairRSA } from "@lindorm-io/key-pair";
import { KoaApp } from "@lindorm-io/koa";
import { KeyPairMemoryCache, KeyPairRedisRepository } from "@lindorm-io/koa-keystore";
import { RedisConnection } from "@lindorm-io/redis";
import MockDate from "mockdate";
import request from "supertest";
import { createNodeServer } from "../util/create-node-server";

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
          alg: "ES512",
          created_at: 1577865600,
          crv: "P-521",
          expires_at: 1861948800,
          key_ops: ["verify"],
          kid: "7531da89-12e9-403e-925a-5da49100635c",
          kty: "EC",
          not_before: 1577865600,
          origin_uri: "https://example.com",
          owner_id: "783f4859-562e-41e5-9c81-a392c12344c0",
          use: "sig",
          x: "AHxwF8PAKLjUbiRVbhXdjzqcgwwLKljN87yBiOlLT3WXGQyChNFLcszWnrkpB/AGiWtYh1Wtts4gsBJ/Tp9CwfDm",
          y: "AS3iydW4wE74tLql6xf28DxBPUuNfvlerYiectjVVOh42bGS4z6gNmCoc5jDN9SG77NloDkC4SSo+LjtMD2IJJhV",
        },
        {
          alg: "RS512",
          created_at: 1577862000,
          e: "AQAB",
          expires_at: 1861948800,
          key_ops: ["decrypt", "verify"],
          kid: "e6301473-e347-4035-8084-8645d034e4a3",
          kty: "RSA",
          n: "8h//VGbmGCMm/cywfEEviNkR7o3yL0yZktzqb95VtwsGatj3JbOpu7FwePJww0CBVZw3zE+bnNcVyaZFMfhm8uNEBOA5JQBWs2ZJhflIGz4oYWcWeMtocwh0kNVLtz1071a9O7JOAVR64KslbactXAeSIcMk7c9reKffVgymZnTTNHMhECtbz77RCUpgLgEG/PUU44N9cYWtPfOvUnxrA6ocxG8Y+IggG6TYtiDwTBScypg9u59/xLLevM+SRwGomM3dyx6h4W3DnT8kwIRrBvsNhmmqoMEOjQYPbfVHP/RkES9pdIFy2jdw4TrLFhwU9dSgQLpZ5EK+7CylcbdhgNqo/Bm0XgiKFKPeYvspNXXVuaVRGhopz3HmEQyaCrDjvX7GF4BJ4j26rotqKxurZDNOEKuLUWwRle/Ft6/zbbrUXdV2rBvrmx+YW8aKJiUpJhgT8rSRZeLZ/CJ+G8ZONp2bqvZqkeRhg3XcvyrBcdeT947FOFz5wZg8mnBNnDJeVs+kdUh9FP3q0T/DVcf0ebED2pxhMjmAq7oa+Gk5UPU61+EdP9pCsJrjyzu7watHSkszd8MetQ8MRUWzhplnsFJI16AKvNN03FWNk2eTd36Tzm/7SX8IFDpORQUua2TivVRvRWWpl6wC0w7/oajFii+iDDdA4h4BjPAgvjmx38c=",
          not_before: 1577862000,
          origin_uri: "https://example.com",
          owner_id: "ffe189e0-c82e-42d1-84ea-1bf4d4d07117",
          use: "sig",
        },
      ],
    });
  });
});
