import { CreateOpaqueToken, createOpaqueToken } from "@lindorm-io/jwt";
import { createMockRedisRepository } from "@lindorm-io/redis";
import MockDate from "mockdate";
import { Client, ClientSession, OpaqueToken } from "../../entity";
import {
  createTestAccessToken,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";
import { generateAccessToken } from "./generate-access-token";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("generateAccessToken", () => {
  let ctx: any;
  let client: Client;
  let clientSession: ClientSession;
  let opaqueToken: CreateOpaqueToken;

  beforeEach(() => {
    ctx = {
      redis: {
        opaqueTokenCache: createMockRedisRepository(createTestAccessToken),
      },
    };

    client = createTestClient();
    clientSession = createTestClientSession({
      id: "3423c10a-fa49-4ad7-9c9b-235bd89a956c",
    });
    opaqueToken = createOpaqueToken({
      id: "678a9ce1-7a87-4e60-ad04-946396a2056a",
    });
  });

  test("should resolve update authorization session with code", async () => {
    await expect(
      generateAccessToken(ctx, client, clientSession, opaqueToken),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        id: "678a9ce1-7a87-4e60-ad04-946396a2056a",
        clientSessionId: "3423c10a-fa49-4ad7-9c9b-235bd89a956c",
        expires: new Date("2021-01-01T08:01:39.000Z"),
        signature: opaqueToken.signature,
        type: "access_token",
      }),
    );

    expect(ctx.redis.opaqueTokenCache.create).toHaveBeenCalledWith(expect.any(OpaqueToken));
  });

  test("should resolve with expires from client session", async () => {
    clientSession.expires = new Date("2021-01-01T08:00:10.000Z");

    await expect(
      generateAccessToken(ctx, client, clientSession, opaqueToken),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        expires: new Date("2021-01-01T08:00:10.000Z"),
      }),
    );
  });
});
