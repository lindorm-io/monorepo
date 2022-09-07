import MockDate from "mockdate";
import request from "supertest";
import { KeyPairCache } from "@lindorm-io/koa-keystore";
import { KoaApp } from "@lindorm-io/koa";
import { RedisConnection } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import { createNodeServer } from "../util/create-node-server";
import { createTestKeyPair } from "@lindorm-io/key-pair";
import { createWellKnownJwksRouter } from "./well-known-jwks";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("/.well-known", () => {
  let server: KoaApp;

  beforeAll(async () => {
    const logger = createMockLogger();

    const redisConnection = new RedisConnection(
      {
        host: "localhost",
        port: 6376,
      },
      logger,
    );

    server = createNodeServer({
      host: "http://localhost",
      logger,
      keystore: {
        exposePublic: true,
        keyPairCache: true,
      },
      port: 3000,
      redisConnection,
    });

    server.addRoute("/.well-known/jwks.json", createWellKnownJwksRouter(false));

    const keyPairCache = new KeyPairCache({ connection: redisConnection, logger });
    await keyPairCache.create(createTestKeyPair());
  });

  test("GET /jwks.json", async () => {
    const response = await request(server.callback()).get("/.well-known/jwks.json").expect(200);

    expect(response.body).toStrictEqual({
      keys: [
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
