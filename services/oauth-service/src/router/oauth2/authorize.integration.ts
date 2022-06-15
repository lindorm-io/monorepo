import MockDate from "mockdate";
import request from "supertest";
import { baseHash, createURL } from "@lindorm-io/core";
import { createTestClient } from "../../fixtures/entity";
import { getTestData } from "../../fixtures/data";
import { server } from "../../server/server";
import { randomUUID } from "crypto";
import {
  DisplayMode,
  PromptMode,
  ResponseMode,
  ResponseType,
  Scope,
  SessionStatus,
} from "../../common";
import {
  getTestIdToken,
  setupIntegration,
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_CLIENT_CACHE,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/authorize", () => {
  beforeAll(setupIntegration);

  test("GET /", async () => {
    const { codeChallenge, codeChallengeMethod, nonce, state } = getTestData();

    const client = await TEST_CLIENT_CACHE.create(createTestClient());

    const identityId = randomUUID();
    const idToken = getTestIdToken({
      audiences: [client.id],
      claims: {
        email: "email@lindorm.io",
        phoneNumber: "+46705498721",
        username: "identity_username",
      },
      subject: identityId,
    });

    const redirectData = baseHash(JSON.stringify({ string: "string", number: 123, boolean: true }));

    const url = createURL("/oauth2/authorize", {
      host: "https://test.test",
      query: {
        acrValues: ["loa_3", "session_otp", "email_otp", "phone_otp"],
        authToken: "auth.jwt.jwt",
        clientId: client.id,
        codeChallenge,
        codeChallengeMethod,
        display: DisplayMode.PAGE,
        idTokenHint: idToken,
        loginHint: "test@lindorm.io",
        maxAge: 3600,
        nonce,
        prompt: [PromptMode.LOGIN, PromptMode.CONSENT],
        redirectData,
        redirectUri: "https://test.client.lindorm.io/redirect",
        responseMode: ResponseMode.FRAGMENT,
        responseType: [ResponseType.CODE, ResponseType.TOKEN],
        scope: [
          Scope.ADDRESS,
          Scope.EMAIL,
          Scope.OFFLINE_ACCESS,
          Scope.OPENID,
          Scope.PHONE,
          Scope.PROFILE,
        ],
        state,
        uiLocales: ["sv-SE", "en-GB"],
      },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://authentication.test.lindorm.io");
    expect(location.pathname).toBe("/oauth/login");
    expect(location.searchParams.get("session_id")).toStrictEqual(expect.any(String));

    const session = await TEST_AUTHORIZATION_SESSION_CACHE.find({
      id: location.searchParams.get("session_id"),
    });

    expect(session).toStrictEqual(
      expect.objectContaining({
        audiences: [client.id],
        authToken: "auth.jwt.jwt",
        authenticationMethods: ["session_otp", "email_otp", "phone_otp"],
        authenticationStatus: SessionStatus.PENDING,
        browserSessionId: expect.any(String),
        clientId: client.id,
        code: null,
        codeChallenge: codeChallenge,
        codeChallengeMethod: "S256",
        consentStatus: SessionStatus.PENDING,
        displayMode: "page",
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: expect.any(String),
        identityId: identityId,
        levelOfAssurance: 3,
        loginHint: ["test@lindorm.io", "email@lindorm.io", "+46705498721", "identity_username"],
        maxAge: 3600,
        nonce: nonce,
        originalUri: expect.any(String),
        promptModes: ["login", "consent"],
        redirectData,
        redirectUri: "https://test.client.lindorm.io/redirect",
        responseMode: "fragment",
        responseTypes: ["code", "token"],
        scopes: ["address", "email", "offline_access", "openid", "phone", "profile"],
        state: state,
        uiLocales: ["sv-SE", "en-GB"],
      }),
    );

    expect(response.headers["set-cookie"]).toEqual([
      `lindorm_io_oauth_browser_session=${session.browserSessionId}; path=/; domain=https://test.lindorm.io; samesite=none`,
      `lindorm_io_oauth_authorization_session=${session.id}; path=/; expires=Fri, 01 Jan 2021 08:30:00 GMT; domain=https://test.lindorm.io; samesite=none`,
    ]);
  });
});
