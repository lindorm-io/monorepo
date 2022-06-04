import { createMockCache } from "@lindorm-io/redis";
import { getTestLogoutSession } from "../../test/entity";
import { oauthRejectLogout as _oauthRejectLogout } from "../../handler";
import { rejectLogoutController } from "./reject-logout";

jest.mock("../../handler");

const oauthRejectLogout = _oauthRejectLogout as jest.Mock;

describe("rejectLogoutController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        logoutSessionCache: createMockCache(),
      },
      entity: {
        logoutSession: getTestLogoutSession(),
      },
      deleteCookie: jest.fn(),
    };

    oauthRejectLogout.mockResolvedValue({ redirectTo: "oauthRejectLogout" });
  });

  test("should resolve", async () => {
    await expect(rejectLogoutController(ctx)).resolves.toStrictEqual({
      redirect: "oauthRejectLogout",
    });

    expect(oauthRejectLogout).toHaveBeenCalled();
    expect(ctx.cache.logoutSessionCache.destroy).toHaveBeenCalled();
    expect(ctx.deleteCookie).toHaveBeenCalled();
  });
});
