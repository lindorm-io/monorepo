import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { SessionStatus } from "../../common";
import { createMockLogger } from "@lindorm-io/winston";
import { getTestAuthorizationSession } from "../../test/entity";
import { rejectLogoutController } from "./reject-logout";
import { createMockCache } from "@lindorm-io/redis";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("rejectLogoutController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        logoutSessionCache: createMockCache(),
      },
      entity: {
        logoutSession: getTestAuthorizationSession(),
      },
      logger: createMockLogger(),
    };
  });

  test("should resolve", async () => {
    await expect(rejectLogoutController(ctx)).resolves.toStrictEqual({
      body: {
        redirectTo:
          "https://test.client.lindorm.io/redirect?error=request_rejected&error_description=logout_rejected&state=9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
      },
    });

    expect(ctx.cache.logoutSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: SessionStatus.REJECTED,
      }),
    );
  });

  test("should throw on invalid status", async () => {
    ctx.entity.logoutSession.status = SessionStatus.REJECTED;

    await expect(rejectLogoutController(ctx)).rejects.toThrow(ClientError);
  });
});
