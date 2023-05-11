import { createTestAuthenticationConfirmationToken } from "../../../fixtures/entity";
import {
  confirmOauthLogin as _confirmOauthLogin,
  resolveAuthenticationConfirmationToken as _resolveAuthenticationConfirmationToken,
} from "../../../handler";
import { confirmLoginSessionController } from "./confirm-login-session";

jest.mock("../../../handler");

const confirmOauthLogin = _confirmOauthLogin as jest.Mock;
const resolveAuthenticationConfirmationToken = _resolveAuthenticationConfirmationToken as jest.Mock;

describe("confirmLoginSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { authenticationConfirmationToken: "authToken" },
    };

    confirmOauthLogin.mockResolvedValue({ redirectTo: "confirmOauthLogin" });
    resolveAuthenticationConfirmationToken.mockResolvedValue(
      createTestAuthenticationConfirmationToken(),
    );
  });

  test("should resolve", async () => {
    await expect(confirmLoginSessionController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "confirmOauthLogin" },
    });
  });
});
