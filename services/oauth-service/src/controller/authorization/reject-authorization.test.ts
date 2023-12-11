import { createMockRedisRepository } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import MockDate from "mockdate";
import { createTestAuthorizationSession } from "../../fixtures/entity";
import { rejectAuthorizationController } from "./reject-authorization";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("rejectAuthorizationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        authorizationSessionCache: createMockRedisRepository(createTestAuthorizationSession),
      },
      entity: {
        authorizationSession: createTestAuthorizationSession({
          state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
        }),
      },
      logger: createMockLogger(),
    };
  });

  test("should resolve", async () => {
    await expect(rejectAuthorizationController(ctx)).resolves.toStrictEqual({
      body: {
        redirectTo: `https://test.client.lindorm.io/redirect?error=request_rejected&error_description=authorization_rejected&state=9auMwEmvzbGrWJG5853OGpAGKQrHKzgX`,
      },
    });

    expect(ctx.redis.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: expect.objectContaining({
          consent: "rejected",
          login: "rejected",
          selectAccount: "rejected",
        }),
      }),
    );
  });
});
