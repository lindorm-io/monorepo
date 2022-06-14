import { createMockCache } from "@lindorm-io/redis";
import { createTestLogoutSession } from "../../fixtures/entity";
import { rejectLogoutController } from "./reject-logout";
import { rejectOauthLogoutSession as _rejectOauthLogoutSession } from "../../handler";

jest.mock("../../handler");

const rejectOauthLogoutSession = _rejectOauthLogoutSession as jest.Mock;

describe("rejectLogoutController", () => {
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

    rejectOauthLogoutSession.mockResolvedValue({ redirectTo: "https://reject" });
  });

  test("should resolve", async () => {
    await expect(rejectLogoutController(ctx)).resolves.toStrictEqual({
      redirect: "https://reject",
    });

    expect(rejectOauthLogoutSession).toHaveBeenCalled();
    expect(ctx.cache.logoutSessionCache.destroy).toHaveBeenCalled();
    expect(ctx.deleteCookie).toHaveBeenCalled();
  });
});
