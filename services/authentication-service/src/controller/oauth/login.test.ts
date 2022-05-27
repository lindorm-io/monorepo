import MockDate from "mockdate";
import { FlowType } from "../../enum";
import { SessionStatus } from "../../common";
import { assertPKCE as _assertPKCE, getExpires } from "@lindorm-io/core";
import { getTestLoginSession } from "../../test/entity";
import { isAuthenticationReadyToConfirm as _isAuthenticationReadyToConfirm } from "../../util";
import { logger } from "../../test/logger";
import { oauthLoginController } from "./login";
import {
  oauthConfirmAuthentication as _oauthConfirmAuthentication,
  oauthGetAuthenticationInfo as _oauthGetAuthenticationInfo,
  oauthSkipAuthentication as _oauthSkipAuthentication,
} from "../../handler";

MockDate.set("2020-01-01T08:00:15.000");

jest.mock("../../handler");
jest.mock("../../util");
jest.mock("@lindorm-io/core", () => ({
  ...(jest.requireActual("@lindorm-io/core") as object),
  assertPKCE: jest.fn(),
}));

const assertPKCE = _assertPKCE as jest.Mock;
const oauthGetAuthenticationInfo = _oauthGetAuthenticationInfo as jest.Mock;
const oauthConfirmAuthentication = _oauthConfirmAuthentication as jest.Mock;
const oauthSkipAuthentication = _oauthSkipAuthentication as jest.Mock;
const isAuthenticationReadyToConfirm = _isAuthenticationReadyToConfirm as jest.Mock;

describe("oauthLoginController", () => {
  let ctx: any;
  let info: any;

  beforeEach(() => {
    ctx = {
      cache: {
        loginSessionCache: {
          findOrCreate: jest.fn().mockImplementation((arg) => getTestLoginSession(arg)),
          update: jest.fn().mockImplementation(async (arg) => arg),
        },
      },
      data: { sessionId: "sessionId" },
      logger,
      setCookie: jest.fn(),
    };

    const { expires, expiresIn } = getExpires(new Date("2022-01-01T08:00:00.000Z"));

    info = {
      authenticationRequired: true,
      authenticationStatus: SessionStatus.PENDING,
      authorizationSession: {
        displayMode: "displayMode",
        expiresAt: expires.toISOString(),
        expiresIn,
        identityId: "identityId",
        loginHint: "loginHint",
        uiLocales: ["en-GB"],
      },
      requested: {
        authenticationId: null,
        authenticationMethods: [
          FlowType.BANK_ID_SE,
          FlowType.EMAIL_OTP,
          FlowType.PHONE_OTP,
          "oidc_apple",
          "oidc_google",
          "oidc_microsoft",
          "unknown_method",
        ],
        country: "country",
        levelOfAssurance: 4,
        pkceVerifier: null,
      },
    };

    oauthGetAuthenticationInfo.mockResolvedValue(info);
    oauthConfirmAuthentication.mockResolvedValue({
      redirectTo: "oauthConfirmAuthentication",
    });
    oauthSkipAuthentication.mockResolvedValue({ redirectTo: "oauthSkipAuthentication" });
    isAuthenticationReadyToConfirm.mockImplementation(() => false);
  });

  test("should resolve", async () => {
    await expect(oauthLoginController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });

    expect(ctx.cache.loginSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        expires: new Date("2022-01-01T08:00:00.000Z"),
        requestedAuthenticationMethods: [
          "bank_id_se",
          "email_otp",
          "phone_otp",
          "oidc_apple",
          "oidc_google",
          "oidc_microsoft",
        ],
      }),
      expect.any(Number),
    );
    expect(ctx.setCookie).toHaveBeenCalled();

    expect(oauthConfirmAuthentication).not.toHaveBeenCalled();
    expect(oauthSkipAuthentication).not.toHaveBeenCalled();
  });

  test("should resolve skip", async () => {
    info.authenticationRequired = false;

    await expect(oauthLoginController(ctx)).resolves.toStrictEqual({
      redirect: "oauthSkipAuthentication",
    });

    expect(oauthSkipAuthentication).toHaveBeenCalled();
  });

  test("should resolve confirm", async () => {
    isAuthenticationReadyToConfirm.mockImplementation(() => true);

    info.requested.pkceVerifier = "pkceVerifier";

    await expect(oauthLoginController(ctx)).resolves.toStrictEqual({
      redirect: "oauthConfirmAuthentication",
    });

    expect(assertPKCE).toHaveBeenCalled();
    expect(oauthConfirmAuthentication).toHaveBeenCalled();
  });
});
