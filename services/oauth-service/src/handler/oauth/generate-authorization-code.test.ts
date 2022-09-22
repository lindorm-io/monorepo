import MockDate from "mockdate";
import { AuthorizationCode, AuthorizationSession } from "../../entity";
import { createMockCache } from "@lindorm-io/redis";
import { createTestAuthorizationCode, createTestAuthorizationSession } from "../../fixtures/entity";
import { generateAuthorizationCode } from "./generate-authorization-code";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("setAuthorizationCode", () => {
  let ctx: any;
  let authorizationSession: AuthorizationSession;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationCodeCache: createMockCache(createTestAuthorizationCode),
      },
    };

    authorizationSession = createTestAuthorizationSession();
  });

  test("should resolve update authorization session with code", async () => {
    await expect(generateAuthorizationCode(ctx, authorizationSession)).resolves.toStrictEqual(
      expect.objectContaining({
        code: expect.any(String),
        expires: new Date("2021-01-01T08:01:00.000Z"),
      }),
    );

    expect(ctx.cache.authorizationCodeCache.create).toHaveBeenCalledWith(
      expect.any(AuthorizationCode),
    );
  });
});
