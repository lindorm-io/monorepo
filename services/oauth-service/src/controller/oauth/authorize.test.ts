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
  setAuthorizationSessionCookie as _setAuthorizationSessionCookie,
  tryFindConsentSession as _tryFindConsentSession,
  tryFindRefreshSession as _tryFindRefreshSession,
} from "../../handler";
import {
  filterAcrValues as _filterAcrValues,
  isAuthenticationRequired as _isAuthenticationRequired,
  isConsentRequired as _isConsentRequired,
} from "../../util";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");
jest.mock("../../util");

const filterAcrValues = _filterAcrValues as jest.Mock;
const isAuthenticationRequired = _isAuthenticationRequired as jest.Mock;
const isConsentRequired = _isConsentRequired as jest.Mock;
const setAuthorizationSessionCookie = _setAuthorizationSessionCookie as jest.Mock;
const tryFindConsentSession = _tryFindConsentSession as jest.Mock;
const tryFindRefreshSession = _tryFindRefreshSession as jest.Mock;

describe("oauthAuthorizeController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationSessionCache: createMockCache(createTestAuthorizationSession),
      },
      data: {
        acrValues: "3 phone_otp session_otp email_otp",
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
        browserSession: createTestBrowserSession({
          id: "eaad7806-26c8-4c53-9db4-298ebea677c7",
          nonce: "6LN9WV959LfBXLk1",
        }),
        client: createTestClient({
          id: "3bfc20bd-0f18-4717-b535-ffb4a071deba",
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
    };

    filterAcrValues.mockImplementation(() => ({
      authenticationMethods: ["phone_otp", "session_otp", "email_otp"],
      levelOfAssurance: 3,
    }));
    isConsentRequired.mockImplementation(() => true);
    isAuthenticationRequired.mockImplementation(() => true);
    tryFindConsentSession.mockResolvedValue(
      createTestConsentSession({ id: "e7511e5c-e2d9-46c8-bffd-5c47dacc8b10" }),
    );
    tryFindRefreshSession.mockResolvedValue(
      createTestRefreshSession({ id: "a6b12333-1cb6-46e4-801d-96fc6d040aa6" }),
    );
  });

  test("should resolve with redirect to login URL", async () => {
    const response = (await oauthAuthorizeController(ctx)) as any;

    expect(response.redirect).toStrictEqual(expect.any(URL));

    const url = response.redirect as URL;

    expect(url.origin).toBe("https://authentication.test.lindorm.io");
    expect(url.pathname).toBe("/oauth/login");
    expect(url.searchParams.get("session_id")).toStrictEqual(expect.any(String));
  });

  test("should resolve for all values", async () => {
    await expect(oauthAuthorizeController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });

    expect(ctx.cache.authorizationSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        audiences: ["3bfc20bd-0f18-4717-b535-ffb4a071deba", "090fd104-7be0-41d1-b877-1c0851318492"],
        authToken: "auth.jwt.jwt",
        authenticationMethods: ["phone_otp", "session_otp", "email_otp"],
        authenticationStatus: "pending",
        browserSessionId: "eaad7806-26c8-4c53-9db4-298ebea677c7",
        clientId: "3bfc20bd-0f18-4717-b535-ffb4a071deba",
        code: null,
        codeChallenge: "codeChallenge",
        codeChallengeMethod: "codeChallengeMethod",
        consentSessionId: "e7511e5c-e2d9-46c8-bffd-5c47dacc8b10",
        consentStatus: "pending",
        country: "se",
        displayMode: "popup",
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: "id.jwt.jwt",
        identityId: "9c0eb0e6-989a-4bcb-a9a6-bc819c6ee3e9",
        levelOfAssurance: 3,
        loginHint: ["+46705498721", "identity_username", "test@lindorm.io"],
        maxAge: 500,
        nonce: "J2qVbRKmMg1UPCty",
        originalUri: "https://oauth.test.lindorm.io/oauth2/authorize?query=query",
        promptModes: ["login", "consent"],
        redirectUri: "https://test.lindorm.io/redirect",
        responseMode: "query",
        responseTypes: ["code", "id_token"],
        scopes: ["openid", "offline_access"],
        state: "l7wj9qEP90kfbAGa",
        uiLocales: ["en-GB", "en-US"],
      }),
    );

    expect(setAuthorizationSessionCookie).toHaveBeenCalled();
  });

  test("should resolve for minimum values", async () => {
    tryFindConsentSession.mockResolvedValue(undefined);

    filterAcrValues.mockImplementation(() => ({
      authenticationMethods: [],
      levelOfAssurance: 0,
    }));

    ctx.data = {
      redirectUri: "https://test.lindorm.io/redirect",
      responseMode: ResponseMode.QUERY,
      responseType: [ResponseType.CODE].join(" "),
      scope: "openid offline_access",
      state: "l7wj9qEP90kfbAGa",
    };

    ctx.token = {};

    await expect(oauthAuthorizeController(ctx)).resolves.toBeTruthy();

    expect(ctx.cache.authorizationSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        audiences: ["3bfc20bd-0f18-4717-b535-ffb4a071deba"],
        authToken: null,
        authenticationMethods: [],
        authenticationStatus: "pending",
        browserSessionId: "eaad7806-26c8-4c53-9db4-298ebea677c7",
        clientId: "3bfc20bd-0f18-4717-b535-ffb4a071deba",
        code: null,
        codeChallenge: null,
        codeChallengeMethod: null,
        consentSessionId: null,
        consentStatus: "pending",
        country: null,
        displayMode: "popup",
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: null,
        identityId: null,
        levelOfAssurance: 3,
        loginHint: [],
        maxAge: null,
        nonce: "6LN9WV959LfBXLk1",
        originalUri: "https://oauth.test.lindorm.io/oauth2/authorize?query=query",
        promptModes: [],
        redirectUri: "https://test.lindorm.io/redirect",
        refreshSessionId: "a6b12333-1cb6-46e4-801d-96fc6d040aa6",
        responseMode: "query",
        responseTypes: ["code"],
        scopes: ["openid", "offline_access"],
        state: "l7wj9qEP90kfbAGa",
        uiLocales: [],
      }),
    );
  });
});
