import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { createMockCache } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestAuthorizationSession } from "../../fixtures/entity";
import { rejectLoginController } from "./reject-login";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("rejectLoginController", () => {
  let ctx: any;
  let authorizationSession = createTestAuthorizationSession({
    state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
  });

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationSessionCache: createMockCache(createTestAuthorizationSession),
      },
      entity: {
        authorizationSession,
      },
      logger: createMockLogger(),
    };
  });

  test("should resolve", async () => {
    await expect(rejectLoginController(ctx)).resolves.toStrictEqual({
      body: {
        redirectTo: `https://test.client.lindorm.io/redirect?error=request_rejected&error_description=login_rejected&state=9auMwEmvzbGrWJG5853OGpAGKQrHKzgX`,
      },
    });

    expect(ctx.cache.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: expect.objectContaining({ login: "rejected" }),
      }),
    );
  });

  test("should throw on invalid status", async () => {
    ctx.entity.authorizationSession.authenticationStatus = "skip";

    await expect(rejectLoginController(ctx)).rejects.toThrow(ClientError);
  });
});
