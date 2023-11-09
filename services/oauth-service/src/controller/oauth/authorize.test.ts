import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
import { randomUnreserved as _randomUnreserved } from "@lindorm-io/random";
import { createMockRedisRepository } from "@lindorm-io/redis";
import MockDate from "mockdate";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";
import {
  isConsentRequired as _isConsentRequired,
  isLoginRequired as _isLoginRequired,
  isSelectAccountRequired as _isSelectAccountRequired,
  isSsoAvailable as _isSsoAvailable,
  setAuthorizationSessionCookie as _setAuthorizationSessionCookie,
  tryFindBrowserSessions as _tryFindBrowserSessions,
  tryFindClientSession as _tryFindClientSession,
} from "../../handler";
import {
  assertAuthorizePrompt as _assertAuthorizePrompt,
  assertAuthorizeResponseType as _assertAuthorizeResponseType,
  assertAuthorizeScope as _assertAuthorizeScope,
  assertRedirectUri as _assertRedirectUri,
  createAuthorizationVerifyUri as _createAuthorizationVerifyUri,
  createConsentPendingUri as _createConsentPendingUri,
  createLoginPendingUri as _createLoginPendingUri,
  createSelectAccountPendingUri as _createSelectAccountPendingUri,
  extractAcrValues as _extractAcrValues,
} from "../../util";
import { oauthAuthorizeController } from "./authorize";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("@lindorm-io/random");
jest.mock("../../handler");
jest.mock("../../util");

const assertAuthorizePrompt = _assertAuthorizePrompt as jest.Mock;
const assertAuthorizeResponseType = _assertAuthorizeResponseType as jest.Mock;
const assertAuthorizeScope = _assertAuthorizeScope as jest.Mock;
const assertRedirectUri = _assertRedirectUri as jest.Mock;
const createAuthorizationVerifyUri = _createAuthorizationVerifyUri as jest.Mock;
const createConsentPendingUri = _createConsentPendingUri as jest.Mock;
const createLoginPendingUri = _createLoginPendingUri as jest.Mock;
const createSelectAccountPendingUri = _createSelectAccountPendingUri as jest.Mock;
const extractAcrValues = _extractAcrValues as jest.Mock;
const isConsentRequired = _isConsentRequired as jest.Mock;
const isLoginRequired = _isLoginRequired as jest.Mock;
const isSsoAvailable = _isSsoAvailable as jest.Mock;
const isSelectAccountRequired = _isSelectAccountRequired as jest.Mock;
const randomUnreserved = _randomUnreserved as jest.Mock;
const setAuthorizationSessionCookie = _setAuthorizationSessionCookie as jest.Mock;
const tryFindBrowserSessions = _tryFindBrowserSessions as jest.Mock;
const tryFindClientSession = _tryFindClientSession as jest.Mock;

describe("oauthAuthorizeController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        authorizationSessionCache: createMockRedisRepository(createTestAuthorizationSession),
      },
      data: {
        acrValues: "3 phone session email",
        clientId: "clientId",
        codeChallenge: "codeChallenge",
        codeChallengeMethod: "S256",
        country: "se",
        display: "popup",
        idTokenHint: "id.jwt.jwt",
        loginHint: "test@lindorm.io",
        maxAge: "500",
        nonce: "J2qVbRKmMg1UPCty",
        prompt: ["login", "consent"].join(" "),
        redirectUri: encodeURI("https://test.lindorm.io/redirect"),
        responseMode: "query",
        responseType: ["code", "id_token"].join(" "),
        scope: "openid offline_access",
        state: "l7wj9qEP90kfbAGa",
        uiLocales: "en-GB en-US",
      },
      entity: {
        client: createTestClient({
          id: "0930e3aa-a00c-4cd1-9d29-57b90e20cd95",
          audiences: {
            credentials: ["4cd74408-f64e-4d93-8ecd-cb2532a9acd1"],
            identity: ["3b50bab6-2962-4193-8d29-410795620df1"],
          },
        }),
      },
      request: {
        originalUrl: "/oauth2/authorize?query=query",
      },
      token: {
        idToken: {
          claims: {
            email: "test@lindorm.io",
            phoneNumber: "+46705498721",
            username: "identity_username",
          },
          metadata: {
            audiences: [
              "3bfc20bd-0f18-4717-b535-ffb4a071deba",
              "090fd104-7be0-41d1-b877-1c0851318492",
            ],
            nonce: "d821cde6250f4918",
          },
          subject: "9c0eb0e6-989a-4bcb-a9a6-bc819c6ee3e9",
          token: "id.jwt.jwt",
        },
      },
      server: {
        environment: "development",
      },
      cookies: {
        set: jest.fn(),
      },
    };

    tryFindBrowserSessions.mockResolvedValue([
      createTestBrowserSession({ id: "b60ca053-4fcb-4f86-a453-05f46cb56040" }),
    ]);
    tryFindClientSession.mockResolvedValue(
      createTestClientSession({ id: "8326d16e-0eb7-4992-994a-2322bfb87019" }),
    );

    assertAuthorizePrompt.mockImplementation();
    assertAuthorizeResponseType.mockImplementation();
    assertAuthorizeScope.mockImplementation();
    assertRedirectUri.mockImplementation();
    createAuthorizationVerifyUri.mockReturnValue("createAuthorizationVerifyUri");
    createConsentPendingUri.mockReturnValue("createConsentPendingUri");
    createLoginPendingUri.mockReturnValue("createLoginPendingUri");
    createSelectAccountPendingUri.mockReturnValue("createSelectAccountPendingUri");
    extractAcrValues.mockReturnValue({
      factors: [AuthenticationFactor.PHISHING_RESISTANT],
      levelOfAssurance: 3,
      methods: [AuthenticationMethod.TIME_BASED_OTP],
      strategies: [AuthenticationStrategy.TIME_BASED_OTP],
    });
    isConsentRequired.mockReturnValue(false);
    isLoginRequired.mockReturnValue(false);
    isSsoAvailable.mockReturnValue(false);
    isSelectAccountRequired.mockReturnValue(false);
    randomUnreserved.mockReturnValue("WuaUxGcvKAkxJJUF");
    setAuthorizationSessionCookie.mockImplementation();
  });

  test("should resolve for all values", async () => {
    await expect(oauthAuthorizeController(ctx)).resolves.toStrictEqual({
      redirect: "createAuthorizationVerifyUri",
    });

    expect(setAuthorizationSessionCookie).toHaveBeenCalled();

    expect(ctx.redis.authorizationSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        browserSessionId: "b60ca053-4fcb-4f86-a453-05f46cb56040",
        clientId: "0930e3aa-a00c-4cd1-9d29-57b90e20cd95",
        code: {
          codeChallenge: "codeChallenge",
          codeChallengeMethod: "S256",
        },
        confirmedConsent: {
          audiences: [],
          scopes: [],
        },
        confirmedLogin: {
          factors: [],
          identityId: null,
          latestAuthentication: null,
          levelOfAssurance: 0,
          metadata: {},
          methods: [],
          remember: false,
          singleSignOn: false,
          strategies: [],
        },
        country: "se",
        displayMode: "popup",
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: "id.jwt.jwt",
        loginHint: ["+46705498721", "identity_username", "test@lindorm.io"],
        maxAge: 500,
        nonce: "J2qVbRKmMg1UPCty",
        originalUri: "https://oauth.test.lindorm.io/oauth2/authorize?query=query",
        promptModes: ["login", "consent"],
        redirectData: null,
        redirectUri: "https://test.lindorm.io/redirect",
        clientSessionId: "8326d16e-0eb7-4992-994a-2322bfb87019",
        requestedConsent: {
          audiences: [
            "090fd104-7be0-41d1-b877-1c0851318492",
            "0930e3aa-a00c-4cd1-9d29-57b90e20cd95",
            "3b50bab6-2962-4193-8d29-410795620df1",
            "3bfc20bd-0f18-4717-b535-ffb4a071deba",
            "6ea68f3d-e31e-4882-85a5-0a617f431fdd",
            "9993fa84-bedf-4a93-a421-1f63719cd9d3",
            "f39e83c0-10d8-49a1-8ecb-bb89f1d57b7f",
          ],
          scopes: ["openid", "offline_access"],
        },
        requestedLogin: {
          factors: [AuthenticationFactor.PHISHING_RESISTANT],
          identityId: "9c0eb0e6-989a-4bcb-a9a6-bc819c6ee3e9",
          levelOfAssurance: 3,
          methods: [AuthenticationMethod.TIME_BASED_OTP],
          minimumLevelOfAssurance: 3,
          strategies: [AuthenticationStrategy.TIME_BASED_OTP],
        },
        requestedSelectAccount: {
          browserSessions: [
            {
              browserSessionId: "b60ca053-4fcb-4f86-a453-05f46cb56040",
              identityId: expect.any(String),
            },
          ],
        },
        responseMode: "query",
        responseTypes: ["code", "id_token"],
        state: "l7wj9qEP90kfbAGa",
        status: {
          consent: "skip",
          login: "skip",
          selectAccount: "skip",
        },
        uiLocales: ["en-GB", "en-US"],
      }),
    );
  });

  test("should resolve for minimum values", async () => {
    tryFindBrowserSessions.mockResolvedValue([]);
    tryFindClientSession.mockResolvedValue(undefined);

    extractAcrValues.mockReturnValue({
      factors: [],
      levelOfAssurance: 0,
      methods: [],
      strategies: [],
    });

    ctx.data = {
      redirectUri: "https://test.lindorm.io/redirect",
      responseType: ["code"].join(" "),
      scope: "openid offline_access",
      state: "l7wj9qEP90kfbAGa",
    };

    ctx.token = {};

    await expect(oauthAuthorizeController(ctx)).resolves.toBeTruthy();

    expect(setAuthorizationSessionCookie).toHaveBeenCalled();

    expect(ctx.redis.authorizationSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        browserSessionId: null,
        clientId: "0930e3aa-a00c-4cd1-9d29-57b90e20cd95",
        code: {
          codeChallenge: null,
          codeChallengeMethod: null,
        },
        confirmedConsent: {
          audiences: [],
          scopes: [],
        },
        confirmedLogin: {
          factors: [],
          identityId: null,
          latestAuthentication: null,
          levelOfAssurance: 0,
          metadata: {},
          methods: [],
          remember: false,
          singleSignOn: false,
          strategies: [],
        },
        country: null,
        displayMode: "popup",
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: null,
        loginHint: [],
        maxAge: null,
        nonce: "WuaUxGcvKAkxJJUF",
        originalUri: "https://oauth.test.lindorm.io/oauth2/authorize?query=query",
        promptModes: [],
        redirectData: null,
        redirectUri: "https://test.lindorm.io/redirect",
        clientSessionId: null,
        requestedConsent: {
          audiences: [
            "0930e3aa-a00c-4cd1-9d29-57b90e20cd95",
            "3b50bab6-2962-4193-8d29-410795620df1",
            "6ea68f3d-e31e-4882-85a5-0a617f431fdd",
            "9993fa84-bedf-4a93-a421-1f63719cd9d3",
            "f39e83c0-10d8-49a1-8ecb-bb89f1d57b7f",
          ],
          scopes: ["openid", "offline_access"],
        },
        requestedLogin: {
          factors: [],
          identityId: null,
          levelOfAssurance: 0,
          methods: [],
          minimumLevelOfAssurance: 3,
          strategies: [],
        },
        requestedSelectAccount: {
          browserSessions: [],
        },
        responseMode: "query",
        responseTypes: ["code"],
        state: "l7wj9qEP90kfbAGa",
        status: {
          consent: "skip",
          login: "skip",
          selectAccount: "skip",
        },
        uiLocales: [],
      }),
    );
  });

  test("should resolve pending select account", async () => {
    isSelectAccountRequired.mockReturnValue(true);

    await expect(oauthAuthorizeController(ctx)).resolves.toStrictEqual({
      redirect: "createSelectAccountPendingUri",
    });

    expect(ctx.redis.authorizationSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: {
          consent: "skip",
          login: "skip",
          selectAccount: "pending",
        },
      }),
    );
  });

  test("should resolve pending login", async () => {
    isLoginRequired.mockReturnValue(true);

    await expect(oauthAuthorizeController(ctx)).resolves.toStrictEqual({
      redirect: "createLoginPendingUri",
    });

    expect(ctx.redis.authorizationSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: {
          consent: "skip",
          login: "pending",
          selectAccount: "skip",
        },
      }),
    );
  });

  test("should resolve pending consent", async () => {
    isConsentRequired.mockReturnValue(true);

    await expect(oauthAuthorizeController(ctx)).resolves.toStrictEqual({
      redirect: "createConsentPendingUri",
    });

    expect(ctx.redis.authorizationSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: {
          consent: "pending",
          login: "skip",
          selectAccount: "skip",
        },
      }),
    );
  });
});
