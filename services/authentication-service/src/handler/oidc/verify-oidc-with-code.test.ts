import { LoginSession, OidcSession } from "../../entity";
import { logger } from "../../test/logger";
import { getTestLoginSession, getTestOidcSession } from "../../test/entity";
import { verifyOidcWithCode } from "./verify-oidc-with-code";
import { getAuthenticatedAccount as _getAuthenticatedAccount } from "./get-authenticated-account";

jest.mock("./get-authenticated-account");

const getAuthenticatedAccount = _getAuthenticatedAccount as jest.Mock;

describe("verifyOidcWithCode", () => {
  let ctx: any;
  let loginSession: LoginSession;
  let oidcSession: OidcSession;
  let code: string;

  beforeEach(() => {
    ctx = {
      axios: {
        axiosClient: {
          post: jest.fn().mockResolvedValue({
            data: {
              accessToken: "jwt.jwt.jwt",
            },
          }),
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

    code = "code";

    getAuthenticatedAccount.mockResolvedValue("getAuthenticatedAccount");
  });

  test("should resolve", async () => {
    await expect(verifyOidcWithCode(ctx, loginSession, oidcSession, code)).resolves.toBe(
      "getAuthenticatedAccount",
    );

    expect(ctx.axios.axiosClient.post).toHaveBeenCalled();
    expect(ctx.axios.axiosClient.get).toHaveBeenCalled();
  });
});
