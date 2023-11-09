import { SessionStatus } from "@lindorm-io/common-enums";
import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { getTestData } from "../../../fixtures/data";
import {
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
  createTestLogoutSession,
} from "../../../fixtures/entity";
import {
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_REPOSITORY,
  TEST_CLIENT_SESSION_REPOSITORY,
  TEST_LOGOUT_SESSION_CACHE,
  getTestIdToken,
  setupIntegration,
} from "../../../fixtures/integration";
import { configuration } from "../../../server/configuration";
import { server } from "../../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/sessions/logout", () => {
  beforeAll(setupIntegration);

  nock("https://test.client.lindorm.io").post("/back-channel-logout").times(999).reply(200);

  test("should create logout session for access session", async () => {
    const { state } = getTestData();

    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        browserSessionId: browserSession.id,
        clientId: client.id,
        identityId: browserSession.identityId,
      }),
    );

    const idToken = getTestIdToken({
      audiences: [configuration.oauth.client_id, client.id],
      client: client.id,
      session: clientSession.id,
      subject: clientSession.identityId,
    });

    const response = await request(server.callback())
      .get("/oauth2/sessions/logout")
      .query({
        client_id: client.id,
        idToken_hint: idToken,
        logout_hint: "logout-hint",
        post_logout_redirect_uri: "https://test.client.lindorm.io/logout",
        state,
        ui_locales: "en-GB sv-SE",
      })
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
          browserSessionId: null,
          clientSessionId: null,
        },
        expires: new Date("2021-01-01T08:01:00.000Z"),
        idTokenHint: idToken,
        identityId: clientSession.identityId,
        logoutHint: "logout-hint",
        originalUri: expect.any(String),
        postLogoutRedirectUri: "https://test.client.lindorm.io/logout",
        requestedLogout: {
          browserSessionId: browserSession.id,
          clientSessionId: clientSession.id,
        },
        state: state,
        status: "pending",
        uiLocales: ["en-GB", "sv-SE"],
      }),
    );
  });

  test("should create logout session for client", async () => {
    const { state } = getTestData();

    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        browserSessionId: browserSession.id,
        clientId: client.id,
        identityId: browserSession.identityId,
      }),
    );

    const idToken = getTestIdToken({
      audiences: [configuration.oauth.client_id, client.id],
      client: client.id,
      session: clientSession.id,
      subject: clientSession.identityId,
    });

    const response = await request(server.callback())
      .get("/oauth2/sessions/logout")
      .set("Cookie", [
        `lindorm_io_oauth_browser_sessions=["${browserSession.id}"]; path=/; httponly`,
      ])
      .query({
        client_id: client.id,
        id_token_hint: idToken,
        logout_hint: "logout-hint",
        post_logout_redirect_uri: "https://test.client.lindorm.io/logout",
        state,
        ui_locales: "en-GB sv-SE",
      })
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
          browserSessionId: null,
          clientSessionId: null,
        },
        expires: new Date("2021-01-01T08:01:00.000Z"),
        idTokenHint: idToken,
        identityId: clientSession.identityId,
        logoutHint: "logout-hint",
        originalUri: expect.any(String),
        postLogoutRedirectUri: "https://test.client.lindorm.io/logout",
        requestedLogout: {
          browserSessionId: browserSession.id,
          clientSessionId: clientSession.id,
        },
        state: state,
        status: "pending",
        uiLocales: ["en-GB", "sv-SE"],
      }),
    );
  });

  test("should logout client session", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        browserSessionId: browserSession.id,
        clientId: client.id,
        identityId: browserSession.identityId,
      }),
    );
    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(
      createTestLogoutSession({
        clientId: client.id,
        confirmedLogout: {
          browserSessionId: browserSession.id,
          clientSessionId: clientSession.id,
        },
        identityId: browserSession.identityId,
        status: SessionStatus.CONFIRMED,
      }),
    );

    const response = await request(server.callback())
      .get("/oauth2/sessions/logout/verify")
      .set("Cookie", [
        `lindorm_io_oauth_browser_sessions=["${browserSession.id}"]; path=/; httponly`,
      ])
      .query({
        session: logoutSession.id,
        post_logout_redirect_uri: "https://test.client.lindorm.io/logout",
      })
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
