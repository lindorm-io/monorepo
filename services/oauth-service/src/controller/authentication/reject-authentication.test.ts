import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { SessionStatus } from "../../common";
import { createMockCache } from "@lindorm-io/redis";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestAuthorizationSession } from "../../fixtures/entity";
import { rejectAuthenticationController } from "./reject-authentication";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("rejectAuthenticationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationSessionCache: createMockCache(createTestAuthorizationSession),
      },
      entity: {
        authorizationSession: createTestAuthorizationSession(),
      },
      logger: createMockLogger(),
    };
  });

  test("should resolve", async () => {
    await expect(rejectAuthenticationController(ctx)).resolves.toStrictEqual({
      body: {
        redirectTo:
          "https://test.client.lindorm.io/redirect?error=request_rejected&error_description=authentication_rejected&state=9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
      },
    });

    expect(ctx.cache.authorizationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticationStatus: SessionStatus.REJECTED,
      }),
    );
  });

  test("should throw on invalid status", async () => {
    ctx.entity.authorizationSession.authenticationStatus = SessionStatus.SKIP;

    await expect(rejectAuthenticationController(ctx)).rejects.toThrow(ClientError);
  });
});
