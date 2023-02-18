import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { configuration } from "../../../server/configuration";
import { createURL } from "@lindorm-io/url";
import { getTestData } from "../../../fixtures/data";
import { server } from "../../../server/server";
import {
  createTestAccessSession,
  createTestBrowserSession,
  createTestClient,
  createTestLogoutSession,
  createTestRefreshSession,
} from "../../../fixtures/entity";
import {
  getTestIdToken,
  setupIntegration,
  TEST_ACCESS_SESSION_REPOSITORY,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_CACHE,
  TEST_LOGOUT_SESSION_CACHE,
  TEST_REFRESH_SESSION_REPOSITORY,
} from "../../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/sessions/logout", () => {
  beforeAll(setupIntegration);

  nock("https://test.client.lindorm.io").post("/back-channel-logout").times(999).reply(200);

  test("should create logout session for access session", async () => {
    const { state } = getTestData();

    const client = await TEST_CLIENT_CACHE.create(createTestClient());
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const accessSession = await TEST_ACCESS_SESSION_REPOSITORY.create(
      createTestAccessSession({
        browserSessionId: browserSession.id,
        clientId: client.id,
        identityId: browserSession.identityId,
      }),
    );

    const idToken = getTestIdToken({
      audiences: [configuration.oauth.client_id, client.id],
      client: client.id,
      session: accessSession.id,
      subject: accessSession.identityId,
    });

    const url = createURL("/oauth2/sessions/logout", {
      host: "https://rm.rm",
      query: {
        clientId: client.id,
        idTokenHint: idToken,
        logoutHint: "logout-hint",
        postLogoutRedirectUri: "https://test.client.lindorm.io/logout",
        state,
        uiLocales: "en-GB sv-SE",
      },
    }).toString();

    const response = await request(server.callback())
      .get(url.replace("https://rm.rm", ""))
      .set("Cookie", [
        `lindorm_io_oauth_browser_sessions=["${browserSession.id}"]; path=/; httponly`,
      ])
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://authentication.test.lindorm.io");
    expect(location.pathname).toBe("/oauth/logout");
    expect(location.searchParams.get("session")).toStrictEqual(expect.any(String));

    await expect(
      TEST_LOGOUT_SESSION_CACHE.find({
        id: location.searchParams.get("session")!,
      }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        clientId: client.id,
        confirmedLogout: {
          accessSessionId: null,
          browserSessionId: null,
          refreshSessionId: null,
        },
        expires: new Date("2021-01-01T08:01:00.000Z"),
        idTokenHint: idToken,
        identityId: accessSession.identityId,
        logoutHint: "logout-hint",
        originalUri: url.replace("https://rm.rm", "https://oauth.test.lindorm.io"),
        postLogoutRedirectUri: "https://test.client.lindorm.io/logout",
        requestedLogout: {
          accessSessionId: accessSession.id,
          accessSessions: [accessSession.id],
          browserSessionId: browserSession.id,
          refreshSessionId: null,
          refreshSessions: [],
        },
        state: state,
        status: "pending",
        uiLocales: ["en-GB", "sv-SE"],
      }),
    );
  });

  test("should create logout session for refresh", async () => {
    const { state } = getTestData();

    const client = await TEST_CLIENT_CACHE.create(createTestClient());
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const refreshSession = await TEST_REFRESH_SESSION_REPOSITORY.create(
      createTestRefreshSession({
        browserSessionId: browserSession.id,
        clientId: client.id,
        identityId: browserSession.identityId,
      }),
    );

    const idToken = getTestIdToken({
      audiences: [configuration.oauth.client_id, client.id],
      client: client.id,
      session: refreshSession.id,
      subject: refreshSession.identityId,
    });

    const url = createURL("/oauth2/sessions/logout", {
      host: "https://rm.rm",
      query: {
        clientId: client.id,
        idTokenHint: idToken,
        logoutHint: "logout-hint",
        postLogoutRedirectUri: "https://test.client.lindorm.io/logout",
        state,
        uiLocales: "en-GB sv-SE",
      },
    }).toString();

    const response = await request(server.callback())
      .get(url.replace("https://rm.rm", ""))
      .set("Cookie", [
        `lindorm_io_oauth_browser_sessions=["${browserSession.id}"]; path=/; httponly`,
      ])
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://authentication.test.lindorm.io");
    expect(location.pathname).toBe("/oauth/logout");
    expect(location.searchParams.get("session")).toStrictEqual(expect.any(String));

    await expect(
      TEST_LOGOUT_SESSION_CACHE.find({
        id: location.searchParams.get("session")!,
      }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        clientId: client.id,
        confirmedLogout: {
          accessSessionId: null,
          browserSessionId: null,
          refreshSessionId: null,
        },
        expires: new Date("2021-01-01T08:01:00.000Z"),
        idTokenHint: idToken,
        identityId: refreshSession.identityId,
        logoutHint: "logout-hint",
        originalUri: url.replace("https://rm.rm", "https://oauth.test.lindorm.io"),
        postLogoutRedirectUri: "https://test.client.lindorm.io/logout",
        requestedLogout: {
          accessSessionId: null,
          accessSessions: [],
          browserSessionId: browserSession.id,
          refreshSessionId: refreshSession.id,
          refreshSessions: [refreshSession.id],
        },
        state: state,
        status: "pending",
        uiLocales: ["en-GB", "sv-SE"],
      }),
    );
  });

  test("should logout refresh session", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const accessSession = await TEST_ACCESS_SESSION_REPOSITORY.create(
      createTestAccessSession({
        browserSessionId: browserSession.id,
        clientId: client.id,
        identityId: browserSession.identityId,
      }),
    );
    const refreshSession = await TEST_REFRESH_SESSION_REPOSITORY.create(
      createTestRefreshSession({
        browserSessionId: browserSession.id,
        clientId: client.id,
        identityId: browserSession.identityId,
      }),
    );
    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(
      createTestLogoutSession({
        clientId: client.id,
        confirmedLogout: {
          accessSessionId: accessSession.id,
          browserSessionId: browserSession.id,
          refreshSessionId: refreshSession.id,
        },
        identityId: browserSession.identityId,
        status: "confirmed",
      }),
    );

    const url = createURL("/oauth2/sessions/logout/verify", {
      host: "https://rm.rm",
      query: {
        postLogoutRedirectUri: "https://test.client.lindorm.io/logout",
        session: logoutSession.id,
      },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://rm.rm", ""))
      .set("Cookie", [
        `lindorm_io_oauth_browser_sessions=["${browserSession.id}"]; path=/; httponly`,
      ])
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://test.client.lindorm.io");
    expect(location.pathname).toBe("/logout");
    expect(location.searchParams.get("state")).toBe(logoutSession.state);

    expect(response.headers["set-cookie"]).toStrictEqual(
      expect.arrayContaining([
        "lindorm_io_oauth_browser_sessions=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly",
      ]),
    );
  });
});
