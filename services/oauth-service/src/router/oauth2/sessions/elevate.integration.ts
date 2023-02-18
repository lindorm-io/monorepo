import MockDate from "mockdate";
import request from "supertest";
import { SessionHint } from "../../../enum";
import { configuration } from "../../../server/configuration";
import { createURL } from "@lindorm-io/url";
import { randomString } from "@lindorm-io/random";
import { server } from "../../../server/server";
import {
  createTestAccessSession,
  createTestBrowserSession,
  createTestClient,
  createTestElevationSession,
  createTestRefreshSession,
} from "../../../fixtures/entity";
import {
  TEST_ACCESS_SESSION_REPOSITORY,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_CACHE,
  TEST_ELEVATION_SESSION_CACHE,
  TEST_REFRESH_SESSION_REPOSITORY,
  getTestAccessToken,
  getTestIdToken,
  setupIntegration,
} from "../../../fixtures/integration";
import { getTestData } from "../../../fixtures/data";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/sessions/elevate", () => {
  beforeAll(setupIntegration);

  test("should resolve initialised elevation with id token for browser session", async () => {
    const { state } = getTestData();

    const client = await TEST_CLIENT_CACHE.create(createTestClient());
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const accessSession = await TEST_ACCESS_SESSION_REPOSITORY.create(
      createTestAccessSession({
        clientId: client.id,
        browserSessionId: browserSession.id,
        identityId: browserSession.identityId,
      }),
    );

    const accessToken = getTestAccessToken({
      client: client.id,
      session: accessSession.id,
      sessionHint: SessionHint.ACCESS,
      subject: accessSession.identityId,
    });

    const idToken = getTestIdToken({
      audiences: [configuration.oauth.client_id],
      claims: {
        email: "email@lindorm.io",
        phoneNumber: "+46705498721",
        username: "identity_username",
      },
      client: client.id,
      session: accessSession.id,
      sessionHint: SessionHint.ACCESS,
      subject: accessSession.identityId,
    });

    const url = createURL("/oauth2/sessions/elevate", {
      host: "https://rm.rm",
      query: {
        clientId: client.id,
        idTokenHint: idToken,
        redirectUri: "https://test.client.lindorm.io/redirect",
        state,
        methods: "password totp",
        uiLocales: "sv-SE en-GB",
      },
    }).toString();

    const response = await request(server.callback())
      .get(url.replace("https://rm.rm", ""))
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", [
        `lindorm_io_oauth_browser_sessions=["${browserSession.id}"]; path=/; httponly`,
      ])
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://authentication.test.lindorm.io");
    expect(location.pathname).toBe("/oauth/elevate");
    expect(location.searchParams.get("session")).toStrictEqual(expect.any(String));
    expect(location.searchParams.get("display")).toBe("page");
    expect(location.searchParams.get("locales")).toBe("sv-SE en-GB");

    await expect(
      TEST_ELEVATION_SESSION_CACHE.find({
        id: location.searchParams.get("session")!,
      }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        accessSessionId: accessSession.id,
        authenticationHint: ["+46705498721", "email@lindorm.io", "identity_username"],
        browserSessionId: browserSession.id,
        clientId: client.id,
        confirmedAuthentication: {
          latestAuthentication: null,
          levelOfAssurance: 0,
          methods: [],
        },
        country: null,
        displayMode: "page",
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: idToken,
        identityId: accessSession.identityId,
        nonce: expect.any(String),
        redirectUri: "https://test.client.lindorm.io/redirect",
        refreshSessionId: null,
        requestedAuthentication: {
          minimumLevel: 1,
          recommendedLevel: 3,
          recommendedMethods: ["email", "phone"],
          requiredLevel: 1,
          requiredMethods: ["password", "totp"],
        },
        state: state,
        status: "pending",
        uiLocales: ["sv-SE", "en-GB"],
      }),
    );
  });

  test("should resolve initialised elevation with request body for refresh session", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const refreshSession = await TEST_REFRESH_SESSION_REPOSITORY.create(
      createTestRefreshSession({
        browserSessionId: browserSession.id,
        clientId: client.id,
        identityId: browserSession.identityId,
      }),
    );

    const accessToken = getTestAccessToken({
      client: client.id,
      session: refreshSession.id,
      sessionHint: SessionHint.REFRESH,
      subject: refreshSession.identityId,
    });

    const response = await request(server.callback())
      .post("/oauth2/sessions/elevate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        authentication_hint: ["email@lindorm.io"],
        client_id: client.id,
        country: "se",
        display: "popup",
        level_of_assurance: 4,
        methods: ["bank_id_se"],
        nonce: "QxEQ4H21R-gslTwr",
        ui_locales: ["sv-SE"],
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      elevation_session_id: expect.any(String),
    });

    await expect(
      TEST_ELEVATION_SESSION_CACHE.find({ id: response.body.elevation_session_id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        accessSessionId: null,
        authenticationHint: ["email@lindorm.io"],
        browserSessionId: null,
        clientId: client.id,
        confirmedAuthentication: {
          latestAuthentication: null,
          levelOfAssurance: 0,
          methods: [],
        },
        country: "se",
        displayMode: "popup",
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: null,
        identityId: refreshSession.identityId,
        nonce: "QxEQ4H21R-gslTwr",
        redirectUri: null,
        refreshSessionId: refreshSession.id,
        requestedAuthentication: {
          minimumLevel: 1,
          recommendedLevel: 1,
          recommendedMethods: [],
          requiredLevel: 4,
          requiredMethods: ["bank_id_se"],
        },
        state: null,
        status: "pending",
        uiLocales: ["sv-SE"],
      }),
    );
  });

  test("should resolve verified elevation session", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const accessSession = await TEST_ACCESS_SESSION_REPOSITORY.create(
      createTestAccessSession({
        clientId: client.id,
        browserSessionId: browserSession.id,
        identityId: browserSession.identityId,
      }),
    );

    const elevationSession = await TEST_ELEVATION_SESSION_CACHE.create(
      createTestElevationSession({
        confirmedAuthentication: {
          latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
          levelOfAssurance: 4,
          methods: ["bank_id_se"],
        },
        requestedAuthentication: {
          minimumLevel: 1,
          recommendedLevel: 2,
          recommendedMethods: ["password"],
          requiredLevel: 4,
          requiredMethods: ["bank_id_se"],
        },

        accessSessionId: accessSession.id,
        browserSessionId: browserSession.id,
        refreshSessionId: null,

        identityId: accessSession.identityId,
        redirectUri: "https://test.client.lindorm.io/redirect",
        state: randomString(16),
        status: "confirmed",
      }),
    );

    const accessToken = getTestAccessToken({
      client: client.id,
      session: accessSession.id,
      sessionHint: SessionHint.REFRESH,
      subject: accessSession.identityId,
    });

    const url = createURL("/oauth2/sessions/elevate/verify", {
      host: "https://rm.rm",
      query: {
        session: elevationSession.id,
      },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://rm.rm", ""))
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", [
        `lindorm_io_oauth_browser_sessions=["${browserSession.id}"]; path=/; httponly`,
      ])
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://test.client.lindorm.io");
    expect(location.pathname).toBe("/redirect");
    expect(location.searchParams.get("state")).toStrictEqual(elevationSession.state);

    await expect(
      TEST_BROWSER_SESSION_REPOSITORY.find({ id: browserSession.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
        methods: ["bank_id_se", "email", "phone"],
      }),
    );
  });
});
