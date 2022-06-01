import { ServerError } from "@lindorm-io/errors";
import { getTestAccount, getTestLoginSession } from "../../test/entity";
import { isAuthenticationReadyToConfirm as _isAuthenticationReadyToConfirm } from "../../util";
import { logger } from "../../test/logger";
import { loginOidcCallbackController } from "./login-oidc-callback";
import {
  axiosGetOidcSession as _axiosGetOidcSession,
  oauthConfirmAuthentication as _oauthConfirmAuthentication,
  resolveAllowedFlows as _resolveAllowedFlows,
} from "../../handler";

jest.mock("../../handler");
jest.mock("../../util");

const axiosGetOidcSession = _axiosGetOidcSession as jest.Mock;
const isAuthenticationReadyToConfirm = _isAuthenticationReadyToConfirm as jest.Mock;
const oauthConfirmAuthentication = _oauthConfirmAuthentication as jest.Mock;
const resolveAllowedFlows = _resolveAllowedFlows as jest.Mock;

describe("loginOidcCallbackController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        loginSessionCache: {
          update: jest.fn().mockImplementation(async (entity) => entity),
        },
      },
      data: {
        sessionId: "c2da005c-017a-430e-adb5-e1bda6f4b615",
      },
      logger,
      entity: {
        loginSession: getTestLoginSession(),
      },
      repository: {
        accountRepository: {
          findOrCreate: jest.fn().mockImplementation(async (options) => getTestAccount(options)),
        },
      },
      deleteCookie: jest.fn(),
    };

    axiosGetOidcSession.mockResolvedValue({
      identityId: "a1dc8f26-3e52-4424-9a8a-d0b94818b99f",
      provider: "apple",
    });
    isAuthenticationReadyToConfirm.mockImplementation(() => false);
    oauthConfirmAuthentication.mockResolvedValue({ redirectTo: "oauthConfirmAuthentication" });
    resolveAllowedFlows.mockImplementation(async (ctx, loginSession, account) => loginSession);
  });

  test("should resolve", async () => {
    await expect(loginOidcCallbackController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });

    expect(axiosGetOidcSession).toHaveBeenCalled();
    expect(oauthConfirmAuthentication).not.toHaveBeenCalled();

    expect(ctx.cache.loginSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        amrValues: ["oidc_apple"],
        identityId: "a1dc8f26-3e52-4424-9a8a-d0b94818b99f",
        levelOfAssurance: 3,
      }),
    );
  });

  test("should resolve URL", async () => {
    const { redirect } = (await loginOidcCallbackController(ctx)) as any;

    const url = new URL(redirect);

    expect(url.host).toBe("frontend.url");
    expect(url.pathname).toBe("/login");
  });

  test("should resolve confirmed authentication", async () => {
    isAuthenticationReadyToConfirm.mockImplementation(() => true);

    await expect(loginOidcCallbackController(ctx)).resolves.toStrictEqual({
      redirect: "oauthConfirmAuthentication",
    });

    expect(oauthConfirmAuthentication).toHaveBeenCalled();
  });

  test("should reject invalid provider", async () => {
    axiosGetOidcSession.mockResolvedValue({
      providerName: "wrong",
    });

    await expect(loginOidcCallbackController(ctx)).rejects.toThrow(ServerError);
  });
});
