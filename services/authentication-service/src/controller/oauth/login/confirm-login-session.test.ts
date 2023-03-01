import { confirmLoginSessionController } from "./confirm-login-session";
import { confirmOauthLogin as _confirmOauthLogin } from "../../../handler";

jest.mock("../../../handler");

const confirmOauthLogin = _confirmOauthLogin as jest.Mock;

describe("confirmLoginSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      token: {
        authenticationConfirmationToken: {
          authContextClass: "authContextClass",
          authMethodsReference: "authMethodsReference",
          subject: "subject",
          levelOfAssurance: "levelOfAssurance",
          claims: {
            remember: "remember",
          },
          session: "session",
        },
      },
    };

    confirmOauthLogin.mockResolvedValue({ redirectTo: "confirmOauthLogin" });
  });

  test("should resolve", async () => {
    await expect(confirmLoginSessionController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "confirmOauthLogin" },
    });
  });
});
