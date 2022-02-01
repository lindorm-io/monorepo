import { LoginSession, OidcSession } from "../../entity";
import { logger } from "../../test/logger";
import { getTestLoginSession, getTestOidcSession } from "../../test/entity";
import { verifyOidcWithAccessToken } from "./verify-oidc-with-access-token";
import { getAuthenticatedAccount as _getAuthenticatedAccount } from "./get-authenticated-account";

jest.mock("./get-authenticated-account");

const getAuthenticatedAccount = _getAuthenticatedAccount as jest.Mock;

describe("verifyOidcWithAccessToken", () => {
  let ctx: any;
  let loginSession: LoginSession;
  let oidcSession: OidcSession;
  let accessToken: string;

  beforeEach(() => {
    ctx = {
      axios: {
        axiosClient: {
          get: jest.fn().mockResolvedValue({
            data: {
              sub: "sub",
              claim1: true,
              claim2: false,
            },
          }),
        },
      },
      logger,
    };

    loginSession = getTestLoginSession();

    oidcSession = getTestOidcSession();

    accessToken = "jwt.jwt.jwt";

    getAuthenticatedAccount.mockResolvedValue("getAuthenticatedAccount");
  });

  test("should resolve", async () => {
    await expect(
      verifyOidcWithAccessToken(ctx, loginSession, oidcSession, accessToken),
    ).resolves.toBe("getAuthenticatedAccount");

    expect(ctx.axios.axiosClient.get).toHaveBeenCalled();
  });
});
