import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { ResponseMode, Scope, SessionStatus } from "../../../common";
import { TEST_GET_USERINFO_RESPONSE } from "../../../fixtures/data";
import { createURL } from "@lindorm-io/core";
import { server } from "../../../server/server";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestConsentSession,
} from "../../../fixtures/entity";
import {
  setupIntegration,
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_CACHE,
  TEST_CONSENT_SESSION_REPOSITORY,
} from "../../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/sessions/verify", () => {
  beforeAll(setupIntegration);

  nock("https://identity.test.lindorm.io")
    .get("/internal/userinfo/d821cde6-250f-4918-ad55-877a7abf0271")
    .query(true)
    .times(999)
    .reply(200, TEST_GET_USERINFO_RESPONSE);

  test("GET /verify - QUERY", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      createTestBrowserSession({
        acrValues: ["loa_3"],
        amrValues: ["email_otp", "phone_otp"],
        clients: [],
        identityId: "d821cde6-250f-4918-ad55-877a7abf0271",
        levelOfAssurance: 3,
      }),
    );

    const consentSession = await TEST_CONSENT_SESSION_REPOSITORY.create(
      createTestConsentSession({
        audiences: [client.id],
        clientId: client.id,
        identityId: "d821cde6-250f-4918-ad55-877a7abf0271",
        scopes: [Scope.OPENID, Scope.OFFLINE_ACCESS, Scope.EMAIL],
        sessions: [browserSession.id],
      }),
    );

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        browserSessionId: browserSession.id,
        clientId: client.id,
        authenticationStatus: SessionStatus.CONFIRMED,
        consentStatus: SessionStatus.CONFIRMED,
        consentSessionId: consentSession.id,
        identityId: "d821cde6-250f-4918-ad55-877a7abf0271",
        promptModes: [],
        scopes: [Scope.OPENID, Scope.OFFLINE_ACCESS, Scope.EMAIL],
      }),
    );

    const url = createURL("/oauth2/sessions/authorize/verify", {
      host: "https://test.test",
      query: {
        sessionId: authorizationSession.id,
        redirectUri: authorizationSession.redirectUri,
      },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .set("Cookie", [
        `lindorm_io_oauth_authorization_session=${authorizationSession.id}; path=/; domain=https://oauth.test.lindorm.io; samesite=none`,
        `lindorm_io_oauth_browser_session=${browserSession.id}; path=/; domain=https://oauth.test.lindorm.io; samesite=none`,
      ])
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://test.client.lindorm.io");
    expect(location.pathname).toBe("/redirect");
    expect(location.searchParams.get("access_token")).toStrictEqual(expect.any(String));
    expect(location.searchParams.get("code")).toStrictEqual(expect.any(String));
    expect(location.searchParams.get("expires_in")).toBe("99");
    expect(location.searchParams.get("id_token")).toStrictEqual(expect.any(String));
    expect(location.searchParams.get("state")).toBe(authorizationSession.state);
    expect(location.searchParams.get("token_type")).toBe("Bearer");
  });

  test("GET /verify - FORM_POST", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      createTestBrowserSession({
        acrValues: ["loa_3"],
        amrValues: ["email_otp", "phone_otp"],
        clients: [],
        identityId: "d821cde6-250f-4918-ad55-877a7abf0271",
        levelOfAssurance: 3,
      }),
    );

    const consentSession = await TEST_CONSENT_SESSION_REPOSITORY.create(
      createTestConsentSession({
        audiences: [client.id],
        clientId: client.id,
        identityId: "d821cde6-250f-4918-ad55-877a7abf0271",
        scopes: [Scope.OPENID, Scope.OFFLINE_ACCESS, Scope.EMAIL],
        sessions: [browserSession.id],
      }),
    );

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        browserSessionId: browserSession.id,
        clientId: client.id,
        authenticationStatus: SessionStatus.CONFIRMED,
        consentStatus: SessionStatus.CONFIRMED,
        consentSessionId: consentSession.id,
        identityId: "d821cde6-250f-4918-ad55-877a7abf0271",
        promptModes: [],
        responseMode: ResponseMode.FORM_POST,
        scopes: [Scope.OPENID, Scope.OFFLINE_ACCESS, Scope.EMAIL],
      }),
    );

    const url = createURL("/oauth2/sessions/authorize/verify", {
      host: "https://test.test",
      query: {
        sessionId: authorizationSession.id,
        redirectUri: authorizationSession.redirectUri,
      },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .set("Cookie", [
        `lindorm_io_oauth_authorization_session=${authorizationSession.id}; path=/; domain=https://oauth.test.lindorm.io; samesite=none`,
        `lindorm_io_oauth_browser_session=${browserSession.id}; path=/; domain=https://oauth.test.lindorm.io; samesite=none`,
      ])
      .expect(308);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://test.client.lindorm.io");
    expect(location.pathname).toBe("/redirect");
    expect(response.body).toStrictEqual({
      access_token: expect.any(String),
      code: expect.any(String),
      expires_in: 99,
      id_token: expect.any(String),
      redirect_data:
        "ZXlKemRISnBibWNpT2lKemRISnBibWNpTENKdWRXMWlaWElpT2pFeU15d2lZbTl2YkdWaGJpSTZkSEoxWlgwPQ==",
      state: "9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
      token_type: "Bearer",
    });
  });
});
