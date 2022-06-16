import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { SessionStatus } from "../../common";
import { createMockCache } from "@lindorm-io/redis";
import { createTestAuthenticationSession, createTestLoginSession } from "../../fixtures/entity";
import { getExpires } from "@lindorm-io/core";
import { initialiseLoginController } from "./initialise-login";
import {
  confirmOauthAuthenticationSession as _confirmOauthAuthenticationSession,
  fetchOauthAuthenticationInfo as _fetchOauthAuthenticationInfo,
  handleAuthenticationInitialisation as _handleAuthenticationInitialisation,
  skipOauthAuthenticationSession as _skipOauthAuthenticationSession,
} from "../../handler";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");

const confirmOauthAuthenticationSession = _confirmOauthAuthenticationSession as jest.Mock;
const fetchOauthAuthenticationInfo = _fetchOauthAuthenticationInfo as jest.Mock;
const handleAuthenticationInitialisation = _handleAuthenticationInitialisation as jest.Mock;
const skipOauthAuthenticationSession = _skipOauthAuthenticationSession as jest.Mock;

describe("initialiseLoginController", () => {
  let ctx: any;
  let info: any;

  beforeEach(() => {
    ctx = {
      cache: {
        loginSessionCache: createMockCache(createTestLoginSession),
      },
      data: {
        sessionId: "1719f770-5168-41e8-87ae-e5f8e74577ea",
      },
      jwt: {
        verify: jest.fn().mockImplementation(() => ({
          authContextClass: ["loa_3"],
          authMethodsReference: ["email_otp"],
          claims: {
            remember: true,
          },
          levelOfAssurance: 3,
          subject: "f9f38066-843f-47f6-bbc9-5f60866741b2",
        })),
      },
      setCookie: jest.fn(),
    };

    const { expires, expiresIn } = getExpires(new Date("2022-01-01T08:15:00.000Z"));

    info = {
      authenticationRequired: true,
      authenticationStatus: "pending",
      authorizationSession: {
        displayMode: "page",
        expiresAt: expires.toISOString(),
        expiresIn,
        identityId: "10e79f7f-8ae8-40c8-a1cb-81d9c2874898",
        loginHint: ["test@lindorm.io", "+46701234567"],
        uiLocales: ["sv-SE", "en-GB"],
      },
      requested: {
        authToken: null,
        authenticationMethods: ["email_otp", "phone_otp"],
        country: "se",
        levelOfAssurance: 4,
      },
    };

    confirmOauthAuthenticationSession.mockResolvedValue({
      redirectTo: "https://confirm",
    });

    fetchOauthAuthenticationInfo.mockResolvedValue(info);

    handleAuthenticationInitialisation.mockImplementation(async (ctx, options) =>
      createTestAuthenticationSession(options),
    );

    skipOauthAuthenticationSession.mockResolvedValue({
      redirectTo: "https://skip",
    });
  });

  test("should resolve", async () => {
    await expect(initialiseLoginController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });

    expect(handleAuthenticationInitialisation).toHaveBeenCalledWith(expect.any(Object), {
      id: expect.any(String),
      clientId: "6ea68f3d-e31e-4882-85a5-0a617f431fdd",
      codeChallenge: expect.any(String),
      codeChallengeMethod: "S256",
      country: "se",
      emailHint: "test@lindorm.io",
      expires: new Date("2022-01-01T08:15:00.000Z"),
      identityId: "10e79f7f-8ae8-40c8-a1cb-81d9c2874898",
      loginSessionId: expect.any(String),
      nonce: expect.any(String),
      phoneHint: "+46701234567",
      redirectUri: "https://authentication.test.lindorm.io:3100/sessions/login/confirm",
      requestedLevelOfAssurance: 4,
      requestedMethods: ["email_otp", "phone_otp"],
    });

    expect(ctx.cache.loginSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        authenticationSessionId: expect.any(String),
        codeVerifier: expect.any(String),
        expires: new Date("2022-01-01T08:15:00.000Z"),
        oauthSessionId: "1719f770-5168-41e8-87ae-e5f8e74577ea",
      }),
    );
  });

  test("should resolve correct URL", async () => {
    const response = (await initialiseLoginController(ctx)) as any;

    expect(response.redirect.toString()).toBe(
      "https://frontend.url/login?display_mode=page&ui_locales=sv-SE+en-GB",
    );
  });

  test("should skip session", async () => {
    info.authenticationRequired = false;

    await expect(initialiseLoginController(ctx)).resolves.toStrictEqual({
      redirect: "https://skip",
    });
  });

  test("should confirm session", async () => {
    info.requested.authToken = "jwt.jwt.jwt";

    await expect(initialiseLoginController(ctx)).resolves.toStrictEqual({
      redirect: "https://confirm",
    });
  });

  test("should throw on invalid session status", async () => {
    info.authenticationStatus = SessionStatus.REJECTED;

    await expect(initialiseLoginController(ctx)).rejects.toThrow(ClientError);
  });
});
