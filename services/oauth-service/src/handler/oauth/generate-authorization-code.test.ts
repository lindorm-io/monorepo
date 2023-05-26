import { createMockRedisRepository } from "@lindorm-io/redis";
import MockDate from "mockdate";
import { AuthorizationCode, AuthorizationSession } from "../../entity";
import { createTestAuthorizationCode, createTestAuthorizationSession } from "../../fixtures/entity";
import { generateAuthorizationCode } from "./generate-authorization-code";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("setAuthorizationCode", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;

  beforeEach(() => {
    ctx = {
      redis: {
        authorizationCodeCache: createMockRedisRepository(createTestAuthorizationCode),
      },
    };

    authorizationSession = createTestAuthorizationSession();
  });

  test("should resolve update authorization session with code", async () => {
    await expect(generateAuthorizationCode(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.any(String),
    );

    expect(ctx.redis.authorizationCodeCache.create).toHaveBeenCalledWith(
      expect.any(AuthorizationCode),
    );
  });
});
