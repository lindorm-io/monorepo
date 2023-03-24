import MockDate from "mockdate";
import { Client, ClientSession, OpaqueToken } from "../../entity";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { generateAccessToken } from "./generate-access-token";
import {
  createTestAccessToken,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("generateAccessToken", () => {
  let ctx: any;
  let client: Client;
  let clientSession: ClientSession;

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
  });

  test("should resolve update authorization session with code", async () => {
    await expect(generateAccessToken(ctx, client, clientSession)).resolves.toStrictEqual(
      expect.objectContaining({
        clientSessionId: "3423c10a-fa49-4ad7-9c9b-235bd89a956c",
        expires: new Date("2021-01-01T08:01:39.000Z"),
        token: expect.any(String),
        type: "access_token",
      }),
    );

    expect(ctx.redis.opaqueTokenCache.create).toHaveBeenCalledWith(expect.any(OpaqueToken));
  });
});
