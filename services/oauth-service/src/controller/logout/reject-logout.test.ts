import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestLogoutSession } from "../../fixtures/entity";
import { rejectLogoutController } from "./reject-logout";
import { createMockCache } from "@lindorm-io/redis";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("rejectLogoutController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        logoutSessionCache: createMockCache(createTestLogoutSession),
      },
      entity: {
        logoutSession: createTestLogoutSession({
          state: "YuTs0Kaf8UV1I086TptUqz1Yh1PNoJow",
        }),
      },
      logger: createMockLogger(),
    };
  });

  test("should resolve", async () => {
    await expect(rejectLogoutController(ctx)).resolves.toStrictEqual({
      body: {
        redirectTo:
          "https://test.client.lindorm.io/logout?error=request_rejected&error_description=logout_rejected&state=YuTs0Kaf8UV1I086TptUqz1Yh1PNoJow",
      },
    });

    expect(ctx.cache.logoutSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
      }),
    );
  });

  test("should throw on invalid status", async () => {
    ctx.entity.logoutSession.status = "rejected";

    await expect(rejectLogoutController(ctx)).rejects.toThrow(ClientError);
  });
});
