import MockDate from "mockdate";
import request from "supertest";
import { SessionHint } from "../../../enum";
import { configuration } from "../../../server/configuration";
import { createURL } from "@lindorm-io/url";
import { randomString } from "@lindorm-io/random";
import { server } from "../../../server/server";
import {
  createTestBrowserSession,
  createTestClient,
  createTestElevationSession,
  createTestRefreshSession,
} from "../../../fixtures/entity";
import {
  getTestAccessToken,
  getTestIdToken,
  setupIntegration,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_CACHE,
  TEST_ELEVATION_SESSION_CACHE,
  TEST_REFRESH_SESSION_REPOSITORY,
} from "../../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/sessions/elevate", () => {
  beforeAll(setupIntegration);

  test("should resolve initialised elevation with id token for browser session", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());

    const accessToken = getTestAccessToken({
      sessionId: browserSession.id,
      sessionHint: SessionHint.BROWSER,
      subject: browserSession.identityId,
    });
    const idToken = getTestIdToken({
      audiences: [configuration.oauth.client_id],
      claims: {
        email: "email@lindorm.io",
        phoneNumber: "+46705498721",
        username: "identity_username",
      },
      sessionId: browserSession.id,
      sessionHint: SessionHint.BROWSER,
      subject: browserSession.identityId,
    });

    const response = await request(server.callback())
      .post("/oauth2/sessions/elevate")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", [`lindorm_io_oauth_browser_session=${browserSession.id}; path=/; httponly`])
      .send({
        client_id: client.id,
        id_token_hint: idToken,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      elevation_session_id: expect.any(String),
    });

    await expect(
      TEST_ELEVATION_SESSION_CACHE.find({ id: response.body.elevation_session_id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        authenticationHint: expect.arrayContaining([
          "+46705498721",
          "email@lindorm.io",
          "identity_username",
        ]),
        clientId: client.id,
        country: null,
        idTokenHint: idToken,
        identifiers: {
          browserSessionId: browserSession.id,
          refreshSessionId: null,
        },
        identityId: browserSession.identityId,
        nonce: expect.any(String),
        requestedAuthentication: {
          minimumLevel: 1,
          recommendedLevel: 3,
          recommendedMethods: ["email", "phone"],
          requiredLevel: 1,
          requiredMethods: [],
        },
        status: "pending",
        uiLocales: [],
      }),
    );
  });

  test("should resolve initialised elevation with request body for refresh session", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());
    const refreshSession = await TEST_REFRESH_SESSION_REPOSITORY.create(createTestRefreshSession());

    const accessToken = getTestAccessToken({
      sessionId: refreshSession.id,
      sessionHint: SessionHint.REFRESH,
      subject: refreshSession.identityId,
    });

    const response = await request(server.callback())
      .post("/oauth2/sessions/elevate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        acr_value: 4,
        amr_values: ["bank_id_se"],
        authentication_hint: ["email@lindorm.io"],
        client_id: client.id,
        country: "se",
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
        authenticationHint: ["email@lindorm.io"],
        clientId: client.id,
        country: "se",
        idTokenHint: null,
        identifiers: {
          browserSessionId: null,
          refreshSessionId: refreshSession.id,
        },
        identityId: refreshSession.identityId,
        nonce: "QxEQ4H21R-gslTwr",
        requestedAuthentication: {
          minimumLevel: 1,
          recommendedLevel: 1,
          recommendedMethods: [],
          requiredLevel: 4,
          requiredMethods: ["bank_id_se"],
        },
        status: "pending",
        uiLocales: ["sv-SE"],
      }),
    );
  });

  test("should resolve verified elevation session", async () => {
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const elevationSession = await TEST_ELEVATION_SESSION_CACHE.create(
      createTestElevationSession({
        confirmedAuthentication: {
          acrValues: ["loa_4"],
          amrValues: ["bank_id_se"],
          latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
          levelOfAssurance: 4,
        },
        identifiers: {
          browserSessionId: browserSession.id,
          refreshSessionId: null,
        },
        requestedAuthentication: {
          minimumLevel: 1,
          recommendedLevel: 2,
          recommendedMethods: ["password"],
          requiredLevel: 4,
          requiredMethods: ["bank_id_se"],
        },

        identityId: browserSession.identityId,
        redirectUri: "https://test.client.lindorm.io/redirect",
        state: randomString(16),
        status: "confirmed",
      }),
    );

    const accessToken = getTestAccessToken({
      sessionId: browserSession.id,
      sessionHint: SessionHint.BROWSER,
      subject: browserSession.identityId,
    });

    const url = createURL("/oauth2/sessions/elevate/verify", {
      host: "https://rm.rm",
      query: {
        sessionId: elevationSession.id,
      },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://rm.rm", ""))
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", [`lindorm_io_oauth_browser_session=${browserSession.id}; path=/; httponly`])
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://test.client.lindorm.io");
    expect(location.pathname).toBe("/redirect");
    expect(location.searchParams.get("state")).toStrictEqual(elevationSession.state);

    await expect(
      TEST_BROWSER_SESSION_REPOSITORY.find({ id: browserSession.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        acrValues: ["loa_4"],
        amrValues: ["bank_id_se"],
        expires: new Date("2021-04-01T08:00:00.000Z"),
        latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
        levelOfAssurance: 4,
      }),
    );
  });
});
