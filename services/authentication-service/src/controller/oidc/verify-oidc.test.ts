import { verifyOidcController } from "./verify-oidc";
import { logger } from "../../test/logger";
import {
  oauthConfirmAuthentication as _oauthConfirmAuthentication,
  resolveAllowedFlows as _resolveAllowedFlows,
  verifyOidcWithAccessToken as _verifyOidcWithAccessToken,
  verifyOidcWithCode as _verifyOidcWithCode,
  verifyOidcWithIdToken as _verifyOidcWithIdToken,
} from "../../handler";
import { isAuthenticationReadyToConfirm as _isAuthenticationReadyToConfirm } from "../../util";
import { getTestAccount, getTestLoginSession, getTestOidcSession } from "../../test/entity";

jest.mock("../../handler");
jest.mock("../../util");

const isAuthenticationReadyToConfirm = _isAuthenticationReadyToConfirm as jest.Mock;
const oauthConfirmAuthentication = _oauthConfirmAuthentication as jest.Mock;
const resolveAllowedFlows = _resolveAllowedFlows as jest.Mock;
const verifyOidcWithAccessToken = _verifyOidcWithAccessToken as jest.Mock;
const verifyOidcWithCode = _verifyOidcWithCode as jest.Mock;
const verifyOidcWithIdToken = _verifyOidcWithIdToken as jest.Mock;

describe("verifyOidcController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      axios: {
        axiosClient: {
          get: jest.fn().mockResolvedValue({
            data: { sub: "identity-provider-subject" },
          }),
          post: jest.fn().mockResolvedValue({
            data: { accessToken: "accessToken" },
          }),
        },
      },
      cache: {
        loginSessionCache: {
          update: jest.fn(),
        },
      },
      data: {
        code: "code",
        state: "state",
      },
      entity: {
        loginSession: getTestLoginSession({
          id: "1cf62c70-dfc2-4b3e-8dc1-6907b91c5a7e",
        }),
        oidcSession: getTestOidcSession({
          state: "state",
          loginSessionId: "1cf62c70-dfc2-4b3e-8dc1-6907b91c5a7e",
        }),
      },
      logger,
      deleteCookie: jest.fn(),
    };

    oauthConfirmAuthentication.mockResolvedValue({
      redirectTo: "oauthConfirmAuthentication",
    });

    resolveAllowedFlows.mockImplementation(async (_1, arg) => arg);

    verifyOidcWithAccessToken.mockResolvedValue(
      getTestAccount({
        id: "fc89479b-a53e-4c5c-8508-a947ca098dda",
      }),
    );
    verifyOidcWithCode.mockResolvedValue(
      getTestAccount({
        id: "fc89479b-a53e-4c5c-8508-a947ca098dda",
      }),
    );
    verifyOidcWithIdToken.mockResolvedValue(
      getTestAccount({
        id: "fc89479b-a53e-4c5c-8508-a947ca098dda",
      }),
    );

    isAuthenticationReadyToConfirm.mockImplementation(() => false);
  });

  afterEach(jest.resetAllMocks);

  test("should resolve with code", async () => {
    await expect(verifyOidcController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });

    expect(ctx.cache.loginSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        amrValues: ["oidc_apple"],
        identityId: "fc89479b-a53e-4c5c-8508-a947ca098dda",
        levelOfAssurance: 3,
      }),
    );

    expect(verifyOidcWithCode).toHaveBeenCalled();

    expect(ctx.deleteCookie).toHaveBeenCalledTimes(1);
  });

  test("should resolve with id_token", async () => {
    ctx.entity.oidcSession = getTestOidcSession({
      identityProvider: "google",
      state: "state",
      loginSessionId: "1cf62c70-dfc2-4b3e-8dc1-6907b91c5a7e",
    });

    await expect(verifyOidcController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });

    expect(verifyOidcWithIdToken).toHaveBeenCalled();
  });

  test("should resolve with token", async () => {
    ctx.entity.oidcSession = getTestOidcSession({
      identityProvider: "microsoft",
      state: "state",
      loginSessionId: "1cf62c70-dfc2-4b3e-8dc1-6907b91c5a7e",
    });

    await expect(verifyOidcController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });

    expect(verifyOidcWithAccessToken).toHaveBeenCalled();
  });

  test("should resolve and confirm authentication", async () => {
    isAuthenticationReadyToConfirm.mockImplementation(() => true);

    await expect(verifyOidcController(ctx)).resolves.toStrictEqual({
      redirect: "oauthConfirmAuthentication",
    });

    expect(oauthConfirmAuthentication).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        amrValues: ["oidc_apple"],
        identityId: "fc89479b-a53e-4c5c-8508-a947ca098dda",
        levelOfAssurance: 3,
      }),
    );

    expect(ctx.deleteCookie).toHaveBeenCalledTimes(2);
  });
});
