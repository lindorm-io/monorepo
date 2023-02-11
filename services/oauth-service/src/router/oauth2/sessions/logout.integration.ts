import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { LogoutSessionType } from "../../../enum";
import { configuration } from "../../../server/configuration";
import { createURL } from "@lindorm-io/url";
import { getTestData } from "../../../fixtures/data";
import { randomUUID } from "crypto";
import { server } from "../../../server/server";
import {
  createTestBrowserSession,
  createTestClient,
  createTestConsentSession,
  createTestLogoutSession,
  createTestRefreshSession,
} from "../../../fixtures/entity";
import {
  getTestIdToken,
  setupIntegration,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_CACHE,
  TEST_CONSENT_SESSION_REPOSITORY,
  TEST_LOGOUT_SESSION_CACHE,
  TEST_REFRESH_SESSION_REPOSITORY,
} from "../../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/sessions/logout", () => {
  beforeAll(setupIntegration);

  nock("https://test.client.lindorm.io").post("/logout/back-channel").times(999).reply(200);

  test("should create logout session for browser", async () => {
    const { state } = getTestData();
    const identityId = randomUUID();

    const client = await TEST_CLIENT_CACHE.create(createTestClient());

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      createTestBrowserSession({ identityId }),
    );

    const idToken = getTestIdToken({
      audiences: [configuration.oauth.client_id, client.id],
      sessionId: browserSession.id,
      subject: identityId,
    });

    const url = createURL("/oauth2/sessions/logout", {
      host: "https://test.test",
      query: {
        clientId: client.id,
        idTokenHint: idToken,
        redirectUri: "https://test.lindorm.io/logout",
        sessionId: browserSession.id,
        state,
      },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://authentication.test.lindorm.io");
    expect(location.pathname).toBe("/oauth/logout");
    expect(location.searchParams.get("session_id")).toStrictEqual(expect.any(String));

    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.find({
      id: location.searchParams.get("session_id")!,
    });

    expect(logoutSession).toStrictEqual(
      expect.objectContaining({
        clientId: client.id,
        sessionId: browserSession.id,
        idTokenHint: idToken,
        redirectUri: "https://test.lindorm.io/logout",
        state,
      }),
    );
  });

  test("should create logout session for refresh", async () => {
    const { state } = getTestData();
    const identityId = randomUUID();

    const client = await TEST_CLIENT_CACHE.create(createTestClient());

    const refreshSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      createTestBrowserSession({ identityId }),
    );

    const idToken = getTestIdToken({
      audiences: [configuration.oauth.client_id, client.id],
      sessionId: refreshSession.id,
      subject: identityId,
    });

    const url = createURL("/oauth2/sessions/logout", {
      host: "https://test.test",
      query: {
        clientId: client.id,
        idTokenHint: idToken,
        redirectUri: "https://test.lindorm.io/logout",
        sessionId: refreshSession.id,
        state,
      },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://authentication.test.lindorm.io");
    expect(location.pathname).toBe("/oauth/logout");
    expect(location.searchParams.get("session_id")).toStrictEqual(expect.any(String));

    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.find({
      id: location.searchParams.get("session_id")!,
    });

    expect(logoutSession).toStrictEqual(
      expect.objectContaining({
        clientId: client.id,
        sessionId: refreshSession.id,
        idTokenHint: idToken,
        redirectUri: "https://test.lindorm.io/logout",
        state,
      }),
    );
  });

  test("should logout browser session", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());

    const consentSession = await TEST_CONSENT_SESSION_REPOSITORY.create(
      createTestConsentSession({
        audiences: [configuration.oauth.client_id, client.id],
        clientId: client.id,
        identityId: randomUUID(),
        scopes: ["openid"],
      }),
    );

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      createTestBrowserSession({
        clients: [client.id],
        identityId: consentSession.identityId,
      }),
    );

    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(
      createTestLogoutSession({
        clientId: client.id,
        sessionId: browserSession.id,
        sessionType: LogoutSessionType.BROWSER,
        status: "confirmed",
      }),
    );

    const url = createURL("/oauth2/sessions/logout/verify", {
      host: "https://test.test",
      query: {
        redirectUri: "https://test.client.lindorm.io/redirect",
        sessionId: logoutSession.id,
      },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://test.client.lindorm.io");
    expect(location.pathname).toBe("/redirect");
    expect(location.searchParams.get("state")).toBe(logoutSession.state);

    expect(response.headers["set-cookie"]).toEqual([
      "lindorm_io_oauth_browser_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly",
    ]);
  });

  test("should logout refresh session", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());

    const consentSession = await TEST_CONSENT_SESSION_REPOSITORY.create(
      createTestConsentSession({
        audiences: [configuration.oauth.client_id, client.id],
        clientId: client.id,
        identityId: randomUUID(),
        scopes: ["openid"],
      }),
    );

    const refreshSession = await TEST_REFRESH_SESSION_REPOSITORY.create(
      createTestRefreshSession({
        clientId: client.id,
        identityId: consentSession.identityId,
      }),
    );

    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(
      createTestLogoutSession({
        clientId: client.id,
        sessionId: refreshSession.id,
        sessionType: LogoutSessionType.REFRESH,
        status: "confirmed",
      }),
    );

    const url = createURL("/oauth2/sessions/logout/verify", {
      host: "https://test.test",
      query: {
        redirectUri: "https://test.client.lindorm.io/redirect",
        sessionId: logoutSession.id,
      },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://test.client.lindorm.io");
    expect(location.pathname).toBe("/redirect");
    expect(location.searchParams.get("state")).toBe(logoutSession.state);

    expect(response.headers["set-cookie"]).toBeUndefined();
  });
});
