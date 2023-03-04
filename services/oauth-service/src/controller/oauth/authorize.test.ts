import MockDate from "mockdate";
import { createMockCache } from "@lindorm-io/redis";
import { oauthAuthorizeController } from "./authorize";
import { randomString as _randomString } from "@lindorm-io/random";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";
import {
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
  filterAcrValues as _filterAcrValues,
  isConsentRequired as _isConsentRequired,
  isLoginRequired as _isLoginRequired,
  isSelectAccountRequired as _isSelectAccountRequired,
} from "../../util";

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
const filterAcrValues = _filterAcrValues as jest.Mock;
const isConsentRequired = _isConsentRequired as jest.Mock;
const isLoginRequired = _isLoginRequired as jest.Mock;
const isSelectAccountRequired = _isSelectAccountRequired as jest.Mock;
const randomString = _randomString as jest.Mock;
const setAuthorizationSessionCookie = _setAuthorizationSessionCookie as jest.Mock;
const tryFindBrowserSessions = _tryFindBrowserSessions as jest.Mock;
const tryFindClientSession = _tryFindClientSession as jest.Mock;

describe("oauthAuthorizeController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationSessionCache: createMockCache(createTestAuthorizationSession),
      },
      data: {
        acrValues: "3 phone session email",
        authToken: "auth.jwt.jwt",
        clientId: "clientId",
        codeChallenge: "codeChallenge",
        codeChallengeMethod: "codeChallengeMethod",
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
        }),
      },
      request: {
        originalUrl: "/oauth2/authorize?query=query",
      },
      token: {
        idToken: {
          audiences: [
            "3bfc20bd-0f18-4717-b535-ffb4a071deba",
            "090fd104-7be0-41d1-b877-1c0851318492",
          ],
          claims: {
            email: "test@lindorm.io",
            phoneNumber: "+46705498721",
            username: "identity_username",
          },
          nonce: "d821cde6250f4918",
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
    createAuthorizationVerifyUri.mockImplementation(() => "createAuthorizationVerifyUri");
    createConsentPendingUri.mockImplementation(() => "createConsentPendingUri");
    createLoginPendingUri.mockImplementation(() => "createLoginPendingUri");
    createSelectAccountPendingUri.mockImplementation(() => "createSelectAccountPendingUri");
    filterAcrValues.mockImplementation(() => ({
      levelOfAssurance: 3,
      methods: ["phone", "session", "email"],
    }));
    isConsentRequired.mockImplementation(() => false);
    isLoginRequired.mockImplementation(() => false);
    isSelectAccountRequired.mockImplementation(() => false);
    randomString.mockImplementation(() => "WuaUxGcvKAkxJJUF");
    setAuthorizationSessionCookie.mockImplementation();
  });

  test("should resolve for all values", async () => {
    await expect(oauthAuthorizeController(ctx)).resolves.toStrictEqual({
      redirect: "createAuthorizationVerifyUri",
    });

    expect(setAuthorizationSessionCookie).toHaveBeenCalled();

    expect(ctx.cache.authorizationSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        authToken: "auth.jwt.jwt",
        browserSessionId: "b60ca053-4fcb-4f86-a453-05f46cb56040",
        clientId: "0930e3aa-a00c-4cd1-9d29-57b90e20cd95",
        code: {
          codeChallenge: "codeChallenge",
          codeChallengeMethod: "codeChallengeMethod",
        },
        confirmedConsent: {
          audiences: [],
          scopes: [],
        },
        confirmedLogin: {
          identityId: null,
          latestAuthentication: null,
          levelOfAssurance: 0,
          metadata: {},
          methods: [],
          remember: false,
          sso: false,
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
            "3bfc20bd-0f18-4717-b535-ffb4a071deba",
          ],
          scopes: ["openid", "offline_access"],
        },
        requestedLogin: {
          identityId: "9c0eb0e6-989a-4bcb-a9a6-bc819c6ee3e9",
          minimumLevel: 3,
          recommendedLevel: 3,
          recommendedMethods: ["phone", "session", "email"],
          requiredLevel: 3,
          requiredMethods: ["phone", "session", "email"],
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

    filterAcrValues.mockImplementation(() => ({
      requiredMethods: [],
      levelOfAssurance: 0,
    }));

    ctx.data = {
      redirectUri: "https://test.lindorm.io/redirect",
      responseType: ["code"].join(" "),
      scope: "openid offline_access",
      state: "l7wj9qEP90kfbAGa",
    };

    ctx.token = {};

    await expect(oauthAuthorizeController(ctx)).resolves.toBeTruthy();

    expect(setAuthorizationSessionCookie).toHaveBeenCalled();

    expect(ctx.cache.authorizationSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        authToken: null,
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
          identityId: null,
          latestAuthentication: null,
          levelOfAssurance: 0,
          metadata: {},
          methods: [],
          remember: false,
          sso: false,
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
          audiences: ["0930e3aa-a00c-4cd1-9d29-57b90e20cd95"],
          scopes: ["openid", "offline_access"],
        },
        requestedLogin: {
          identityId: null,
          minimumLevel: 3,
          recommendedLevel: 0,
          recommendedMethods: undefined,
          requiredLevel: 0,
          requiredMethods: undefined,
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
    isSelectAccountRequired.mockImplementation(() => true);

    await expect(oauthAuthorizeController(ctx)).resolves.toStrictEqual({
      redirect: "createSelectAccountPendingUri",
    });

    expect(ctx.cache.authorizationSessionCache.create).toHaveBeenCalledWith(
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
    isLoginRequired.mockImplementation(() => true);

    await expect(oauthAuthorizeController(ctx)).resolves.toStrictEqual({
      redirect: "createLoginPendingUri",
    });

    expect(ctx.cache.authorizationSessionCache.create).toHaveBeenCalledWith(
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
    isConsentRequired.mockImplementation(() => true);

    await expect(oauthAuthorizeController(ctx)).resolves.toStrictEqual({
      redirect: "createConsentPendingUri",
    });

    expect(ctx.cache.authorizationSessionCache.create).toHaveBeenCalledWith(
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
