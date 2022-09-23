import MockDate from "mockdate";
import { DisplayMode, PromptMode, ResponseMode, ResponseType } from "../../common";
import { createMockCache } from "@lindorm-io/redis";
import { oauthAuthorizeController } from "./authorize";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestConsentSession,
  createTestRefreshSession,
} from "../../fixtures/entity";
import {
  tryFindBrowserSession as _tryFindBrowserSession,
  tryFindConsentSession as _tryFindConsentSession,
  tryFindRefreshSession as _tryFindRefreshSession,
} from "../../handler";
import {
  assertAuthorizePrompt as _assertAuthorizePrompt,
  assertRedirectUri as _assertAuthorizeRedirectUri,
  assertAuthorizeResponseType as _assertAuthorizeResponseType,
  assertAuthorizeScope as _assertAuthorizeScope,
  createAuthorizationVerifyUri as _createAuthorizationVerifyUri,
  createLoginPendingUri as _createLoginPendingUri,
  filterAcrValues as _filterAcrValues,
  isLoginRequired as _isLoginRequired,
  isConsentRequired as _isConsentRequired,
} from "../../util";
import { Environment } from "@lindorm-io/koa";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");
jest.mock("../../util");

const tryFindBrowserSession = _tryFindBrowserSession as jest.Mock;
const tryFindConsentSession = _tryFindConsentSession as jest.Mock;
const tryFindRefreshSession = _tryFindRefreshSession as jest.Mock;

const assertAuthorizePrompt = _assertAuthorizePrompt as jest.Mock;
const assertAuthorizeRedirectUri = _assertAuthorizeRedirectUri as jest.Mock;
const assertAuthorizeResponseType = _assertAuthorizeResponseType as jest.Mock;
const assertAuthorizeScope = _assertAuthorizeScope as jest.Mock;
const createAuthorizationVerifyUri = _createAuthorizationVerifyUri as jest.Mock;
const createLoginPendingUri = _createLoginPendingUri as jest.Mock;
const filterAcrValues = _filterAcrValues as jest.Mock;
const isLoginRequired = _isLoginRequired as jest.Mock;
const isConsentRequired = _isConsentRequired as jest.Mock;

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
        display: DisplayMode.POPUP,
        idTokenHint: "id.jwt.jwt",
        loginHint: "test@lindorm.io",
        maxAge: "500",
        nonce: "J2qVbRKmMg1UPCty",
        prompt: [PromptMode.LOGIN, PromptMode.CONSENT].join(" "),
        redirectUri: encodeURI("https://test.lindorm.io/redirect"),
        responseMode: ResponseMode.QUERY,
        responseType: [ResponseType.CODE, ResponseType.ID_TOKEN].join(" "),
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
      metadata: {
        environment: Environment.DEVELOPMENT,
      },
      cookies: {
        set: jest.fn(),
      },
    };

    tryFindBrowserSession.mockResolvedValue(
      createTestBrowserSession({
        id: "b60ca053-4fcb-4f86-a453-05f46cb56040",
      }),
    );
    tryFindConsentSession.mockResolvedValue(
      createTestConsentSession({
        id: "89a009bf-b221-49fd-b56d-c1664c9fb2a1",
      }),
    );
    tryFindRefreshSession.mockResolvedValue(
      createTestRefreshSession({
        id: "8326d16e-0eb7-4992-994a-2322bfb87019",
      }),
    );

    assertAuthorizePrompt.mockImplementation();
    assertAuthorizeRedirectUri.mockImplementation();
    assertAuthorizeResponseType.mockImplementation();
    assertAuthorizeScope.mockImplementation();
    createAuthorizationVerifyUri.mockImplementation(() => "createAuthorizationVerifyUri");
    createLoginPendingUri.mockImplementation(() => "createLoginPendingUri");
    filterAcrValues.mockImplementation(() => ({
      levelOfAssurance: 3,
      methods: ["phone", "session", "email"],
    }));
    isLoginRequired.mockImplementation(() => true);
    isConsentRequired.mockImplementation(() => true);
  });

  test("should resolve for all values", async () => {
    await expect(oauthAuthorizeController(ctx)).resolves.toStrictEqual({
      redirect: "createLoginPendingUri",
    });

    expect(ctx.cookies.set).toHaveBeenCalledWith(
      "lindorm_io_oauth_authorization_session",
      expect.any(String),
      {
        expires: new Date("2021-01-01T08:30:00.000Z"),
        httpOnly: true,
        overwrite: true,
        signed: true,
      },
    );

    expect(ctx.cache.authorizationSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        authToken: "auth.jwt.jwt",
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
          acrValues: [],
          amrValues: [],
          identityId: null,
          latestAuthentication: null,
          levelOfAssurance: 0,
          remember: false,
        },
        country: "se",
        displayMode: "popup",
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: "id.jwt.jwt",
        identifiers: {
          browserSessionId: "b60ca053-4fcb-4f86-a453-05f46cb56040",
          consentSessionId: "89a009bf-b221-49fd-b56d-c1664c9fb2a1",
          refreshSessionId: "8326d16e-0eb7-4992-994a-2322bfb87019",
        },
        loginHint: ["+46705498721", "identity_username", "test@lindorm.io"],
        maxAge: 500,
        nonce: "J2qVbRKmMg1UPCty",
        originalUri: "https://oauth.test.lindorm.io/oauth2/authorize?query=query",
        promptModes: ["login", "consent"],
        redirectData: null,
        redirectUri: "https://test.lindorm.io/redirect",
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
        responseMode: "query",
        responseTypes: ["code", "id_token"],
        state: "l7wj9qEP90kfbAGa",
        status: {
          consent: "pending",
          login: "pending",
        },
        uiLocales: ["en-GB", "en-US"],
      }),
    );
  });

  test("should resolve for minimum values", async () => {
    tryFindBrowserSession.mockResolvedValue(undefined);
    tryFindConsentSession.mockResolvedValue(undefined);
    tryFindRefreshSession.mockResolvedValue(undefined);

    filterAcrValues.mockImplementation(() => ({
      requiredMethods: [],
      levelOfAssurance: 0,
    }));

    ctx.data = {
      redirectUri: "https://test.lindorm.io/redirect",
      responseType: [ResponseType.CODE].join(" "),
      scope: "openid offline_access",
      state: "l7wj9qEP90kfbAGa",
    };

    ctx.token = {};

    await expect(oauthAuthorizeController(ctx)).resolves.toBeTruthy();

    expect(ctx.cache.authorizationSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        authToken: null,
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
          acrValues: [],
          amrValues: [],
          identityId: null,
          latestAuthentication: null,
          levelOfAssurance: 0,
          remember: false,
        },
        country: null,
        displayMode: "popup",
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: null,
        identifiers: {
          browserSessionId: null,
          consentSessionId: null,
          refreshSessionId: null,
        },
        loginHint: [],
        maxAge: null,
        nonce: null,
        originalUri: "https://oauth.test.lindorm.io/oauth2/authorize?query=query",
        promptModes: [],
        redirectData: null,
        redirectUri: "https://test.lindorm.io/redirect",
        requestedConsent: {
          audiences: ["0930e3aa-a00c-4cd1-9d29-57b90e20cd95"],
          scopes: ["openid", "offline_access"],
        },
        requestedLogin: {
          identityId: null,
          minimumLevel: 3,
          recommendedLevel: 1,
          recommendedMethods: [],
          requiredLevel: 1,
          requiredMethods: [],
        },
        responseMode: "query",
        responseTypes: ["code"],
        state: "l7wj9qEP90kfbAGa",
        status: {
          consent: "pending",
          login: "pending",
        },
        uiLocales: [],
      }),
    );
  });

  test("should resolve verify uri for skipped login", async () => {
    isLoginRequired.mockImplementation(() => false);
    isConsentRequired.mockImplementation(() => false);

    await expect(oauthAuthorizeController(ctx)).resolves.toStrictEqual({
      redirect: "createAuthorizationVerifyUri",
    });

    expect(ctx.cache.authorizationSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: {
          consent: "skip",
          login: "skip",
        },
      }),
    );
  });
});
