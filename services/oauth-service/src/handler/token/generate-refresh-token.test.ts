import { CreateOpaqueToken, createOpaqueToken } from "@lindorm-io/jwt";
import { createMockRedisRepository } from "@lindorm-io/redis";
import MockDate from "mockdate";
import { Client, ClientSession, OpaqueToken } from "../../entity";
import {
  createTestClient,
  createTestClientSession,
  createTestRefreshToken,
} from "../../fixtures/entity";
import { generateRefreshToken } from "./generate-refresh-token";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("generateRefreshToken", () => {
  let ctx: any;
  let client: Client;
  let clientSession: ClientSession;
  let opaqueToken: CreateOpaqueToken;

  beforeEach(() => {
    ctx = {
      redis: {
        opaqueTokenCache: createMockRedisRepository(createTestRefreshToken),
      },
    };

    client = createTestClient();
    clientSession = createTestClientSession({
      id: "3423c10a-fa49-4ad7-9c9b-235bd89a956c",
    });
    opaqueToken = createOpaqueToken({
      id: "a196ab34-1b87-49d0-800d-aac602fbf451",
    });
  });

  test("should resolve update authorization session with code", async () => {
    await expect(
      generateRefreshToken(ctx, client, clientSession, opaqueToken),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        id: "a196ab34-1b87-49d0-800d-aac602fbf451",
        clientSessionId: "3423c10a-fa49-4ad7-9c9b-235bd89a956c",
        expires: new Date("2021-01-01T08:01:39.000Z"),
        signature: opaqueToken.signature,
        type: "refresh_token",
      }),
    );

    expect(ctx.redis.opaqueTokenCache.create).toHaveBeenCalledWith(expect.any(OpaqueToken));
  });
});
