import { confirmLogoutSessionController } from "./confirm-logout-session";
import { confirmOauthLogout as _confirmOauthLogout } from "../../../handler";

jest.mock("../../../handler");

const confirmOauthLogout = _confirmOauthLogout as jest.Mock;

describe("confirmLogoutSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        id: "id",
        audiences: "audiences",
        scopes: "scopes",
      },
    };

    confirmOauthLogout.mockResolvedValue({ redirectTo: "confirmOauthLogout" });
  });

  test("should resolve", async () => {
    await expect(confirmLogoutSessionController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "confirmOauthLogout" },
    });
  });
});
