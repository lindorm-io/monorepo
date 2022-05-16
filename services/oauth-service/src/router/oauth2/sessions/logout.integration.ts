import MockDate from "mockdate";
import request from "supertest";
import { LogoutSessionType } from "../../../enum";
import { SessionStatus } from "../../../common";
import { createURL } from "@lindorm-io/core";
import { getTestData } from "../../../test/data";
import { server } from "../../../server/server";
import { randomUUID } from "crypto";
import { getTestBrowserSession, getTestClient, getTestLogoutSession } from "../../../test/entity";
import {
  getTestIdToken,
  setupIntegration,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_CACHE,
  TEST_LOGOUT_SESSION_CACHE,
} from "../../../test/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("/oauth2/sessions/logout", () => {
  beforeAll(setupIntegration);

  test("GET / - BROWSER SESSION", async () => {
    const { state } = getTestData();
    const identityId = randomUUID();

    const client = await TEST_CLIENT_CACHE.create(getTestClient());

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      getTestBrowserSession({
        identityId: randomUUID(),
      }),
    );

    const idToken = getTestIdToken({
      audiences: [client.id],
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
      id: location.searchParams.get("session_id"),
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

  test("GET / - REFRESH SESSION", async () => {
    const { state } = getTestData();
    const identityId = randomUUID();

    const client = await TEST_CLIENT_CACHE.create(getTestClient());

    const refreshSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      getTestBrowserSession({
        identityId: randomUUID(),
      }),
    );

    const idToken = getTestIdToken({
      audiences: [client.id],
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
      id: location.searchParams.get("session_id"),
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

  test("GET /verify", async () => {
    const client = await TEST_CLIENT_CACHE.create(getTestClient());

    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(
      getTestLogoutSession({
        clientId: client.id,
        sessionType: LogoutSessionType.BROWSER,
        status: SessionStatus.CONFIRMED,
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
      .set("Cookie", [
        `lindorm_io_oauth_logout_session=${logoutSession.id}; path=/; domain=https://oauth.test.lindorm.io; samesite=none`,
      ])
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://test.client.lindorm.io");
    expect(location.pathname).toBe("/redirect");
    expect(location.searchParams.get("state")).toBe("YuTs0Kaf8UV1I086TptUqz1Yh1PNoJow");

    expect(response.headers["set-cookie"]).toEqual([
      "lindorm_io_oauth_browser_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly",
      "lindorm_io_oauth_logout_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly",
    ]);
  });
});
