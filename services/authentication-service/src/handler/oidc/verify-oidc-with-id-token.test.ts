import { LoginSession, OidcSession } from "../../entity";
import { logger } from "../../test/logger";
import { getTestLoginSession, getTestOidcSession } from "../../test/entity";
import { verifyOidcWithIdToken } from "./verify-oidc-with-id-token";
import { getAuthenticatedAccount as _getAuthenticatedAccount } from "./get-authenticated-account";

jest.mock("./get-authenticated-account");

const getAuthenticatedAccount = _getAuthenticatedAccount as jest.Mock;

describe("verifyOidcWithIdToken", () => {
  let ctx: any;
  let loginSession: LoginSession;
  let oidcSession: OidcSession;
  let idToken: string;

  beforeEach(() => {
    ctx = {
      logger,
      jwt: {
        verify: jest
          .fn()
          .mockImplementation(() => ({ subject: "subject", claims: { claims: true } })),
      },
    };

    loginSession = getTestLoginSession();

    oidcSession = getTestOidcSession();

    idToken = "jwt.jwt.jwt";

    getAuthenticatedAccount.mockResolvedValue("getAuthenticatedAccount");
  });

  test("should resolve", async () => {
    await expect(verifyOidcWithIdToken(ctx, loginSession, oidcSession, idToken)).resolves.toBe(
      "getAuthenticatedAccount",
    );

    expect(ctx.jwt.verify).toHaveBeenCalled();
  });
});
