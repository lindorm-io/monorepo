import { confirmOauthLogin as _confirmOauthLogin } from "../../../handler";
import { confirmLoginSessionController } from "./confirm-login-session";

jest.mock("../../../handler");

const confirmOauthLogin = _confirmOauthLogin as jest.Mock;

describe("confirmLoginSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { authenticationConfirmationToken: "authenticationConfirmationToken" },
    };

    confirmOauthLogin.mockResolvedValue({ redirectTo: "confirmOauthLogin" });
  });

  test("should resolve", async () => {
    await expect(confirmLoginSessionController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "confirmOauthLogin" },
    });
  });
});
