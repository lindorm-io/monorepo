import { confirmLogoutController } from "./confirm-logout";
import { confirmOauthLogoutSession as _confirmOauthLogoutSession } from "../../handler";
import { createMockCache } from "@lindorm-io/redis";
import { createTestLogoutSession } from "../../fixtures/entity";

jest.mock("../../handler");

const confirmOauthLogoutSession = _confirmOauthLogoutSession as jest.Mock;

describe("confirmLogoutController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        logoutSessionCache: createMockCache(createTestLogoutSession),
      },
      entity: {
        logoutSession: createTestLogoutSession(),
      },
      deleteCookie: jest.fn(),
    };

    confirmOauthLogoutSession.mockResolvedValue({ redirectTo: "https://confirm" });
  });

  test("should resolve", async () => {
    await expect(confirmLogoutController(ctx)).resolves.toStrictEqual({
      redirect: "https://confirm",
    });

    expect(confirmOauthLogoutSession).toHaveBeenCalled();
    expect(ctx.cache.logoutSessionCache.destroy).toHaveBeenCalled();
    expect(ctx.deleteCookie).toHaveBeenCalled();
  });
});
