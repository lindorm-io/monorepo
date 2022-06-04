import { confirmLogoutController } from "./confirm-logout";
import { createMockCache } from "@lindorm-io/redis";
import { getTestLogoutSession } from "../../test/entity";
import { oauthConfirmLogout as _oauthConfirmLogout } from "../../handler";

jest.mock("../../handler");

const oauthConfirmLogout = _oauthConfirmLogout as jest.Mock;

describe("confirmLogoutController", () => {
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

    oauthConfirmLogout.mockResolvedValue({ redirectTo: "oauthConfirmLogout" });
  });

  test("should resolve", async () => {
    await expect(confirmLogoutController(ctx)).resolves.toStrictEqual({
      redirect: "oauthConfirmLogout",
    });

    expect(oauthConfirmLogout).toHaveBeenCalled();
    expect(ctx.cache.logoutSessionCache.destroy).toHaveBeenCalled();
    expect(ctx.deleteCookie).toHaveBeenCalled();
  });
});
