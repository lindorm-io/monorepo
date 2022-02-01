import { getTestLogoutSession } from "../../test/entity";
import { oauthConfirmLogout as _oauthConfirmLogout } from "../../handler";
import { confirmLogoutController } from "./confirm-logout";

jest.mock("../../handler");

const oauthConfirmLogout = _oauthConfirmLogout as jest.Mock;

describe("confirmLogoutController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        logoutSessionCache: {
          destroy: jest.fn(),
        },
      },
      entity: { logoutSession: getTestLogoutSession() },
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
