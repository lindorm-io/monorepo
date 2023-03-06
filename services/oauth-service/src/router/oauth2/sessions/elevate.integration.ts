import MockDate from "mockdate";
import request from "supertest";
import { configuration } from "../../../server/configuration";
import { getTestData } from "../../../fixtures/data";
import { randomUnreserved } from "@lindorm-io/random";
import { server } from "../../../server/server";
import { AuthenticationMethod, SessionStatus } from "@lindorm-io/common-types";
import { ClientSessionType } from "../../../enum";
import {
  createTestAccessToken,
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
  createTestElevationSession,
} from "../../../fixtures/entity";
import {
  getTestIdToken,
  setupIntegration,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_REPOSITORY,
  TEST_CLIENT_SESSION_REPOSITORY,
  TEST_ELEVATION_SESSION_CACHE,
  TEST_OPAQUE_TOKEN_CACHE,
} from "../../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/sessions/elevate", () => {
  beforeAll(setupIntegration);

  test("should resolve initialised elevation with redirect", async () => {
    const { state } = getTestData();

    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        clientId: client.id,
        browserSessionId: browserSession.id,
        identityId: browserSession.identityId,
      }),
    );

    const accessToken = await TEST_OPAQUE_TOKEN_CACHE.create(
      createTestAccessToken({
        clientSessionId: clientSession.id,
      }),
    );

    const idToken = getTestIdToken({
      audiences: [configuration.oauth.client_id],
      claims: {
        email: "email@lindorm.io",
        phoneNumber: "+46705498721",
        username: "identity_username",
      },
      client: client.id,
      session: clientSession.id,
      sessionHint: ClientSessionType.EPHEMERAL,
      subject: clientSession.identityId,
    });

    const response = await request(server.callback())
      .get("/oauth2/sessions/elevate")
      .query({
        client_id: client.id,
        id_token_hint: idToken,
        redirect_uri: "https://test.client.lindorm.io/redirect",
        state,
        methods: "password totp",
        ui_locales: "sv-SE en-GB",
      })
      .set("Authorization", `Bearer ${accessToken.token}`)
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
        authenticationHint: ["+46705498721", "email@lindorm.io", "identity_username"],
        browserSessionId: browserSession.id,
        clientId: client.id,
        clientSessionId: clientSession.id,
        confirmedAuthentication: {
          latestAuthentication: null,
          levelOfAssurance: 0,
          methods: [],
        },
        country: null,
        displayMode: "page",
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: idToken,
        identityId: clientSession.identityId,
        nonce: expect.any(String),
        redirectUri: "https://test.client.lindorm.io/redirect",
        requestedAuthentication: {
          minimumLevel: 1,
          recommendedLevel: 3,
          recommendedMethods: ["email", "phone"],
          requiredLevel: 1,
          requiredMethods: [AuthenticationMethod.PASSWORD, AuthenticationMethod.TIME_BASED_OTP],
        },
        state: state,
        status: "pending",
        uiLocales: ["sv-SE", "en-GB"],
      }),
    );
  });

  test("should resolve initialised elevation with body", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        browserSessionId: browserSession.id,
        clientId: client.id,
        identityId: browserSession.identityId,
      }),
    );

    const accessToken = await TEST_OPAQUE_TOKEN_CACHE.create(
      createTestAccessToken({
        clientSessionId: clientSession.id,
      }),
    );

    const response = await request(server.callback())
      .post("/oauth2/sessions/elevate")
      .set("Authorization", `Bearer ${accessToken.token}`)
      .send({
        authentication_hint: ["email@lindorm.io"],
        client_id: client.id,
        country: "se",
        level_of_assurance: 4,
        methods: [AuthenticationMethod.BANK_ID_SE],
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
        browserSessionId: browserSession.id,
        clientId: client.id,
        clientSessionId: clientSession.id,
        confirmedAuthentication: {
          latestAuthentication: null,
          levelOfAssurance: 0,
          methods: [],
        },
        country: "se",
        displayMode: "page",
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: null,
        identityId: clientSession.identityId,
        nonce: "QxEQ4H21R-gslTwr",
        redirectUri: null,
        requestedAuthentication: {
          minimumLevel: 1,
          recommendedLevel: 1,
          recommendedMethods: [],
          requiredLevel: 4,
          requiredMethods: [AuthenticationMethod.BANK_ID_SE],
        },
        state: null,
        status: "pending",
        uiLocales: ["sv-SE"],
      }),
    );
  });

  test("should resolve verified elevation session", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        clientId: client.id,
        browserSessionId: browserSession.id,
        identityId: browserSession.identityId,
      }),
    );

    const accessToken = await TEST_OPAQUE_TOKEN_CACHE.create(
      createTestAccessToken({
        clientSessionId: clientSession.id,
      }),
    );

    const elevationSession = await TEST_ELEVATION_SESSION_CACHE.create(
      createTestElevationSession({
        confirmedAuthentication: {
          latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
          levelOfAssurance: 4,
          methods: [AuthenticationMethod.BANK_ID_SE],
        },
        requestedAuthentication: {
          minimumLevel: 1,
          recommendedLevel: 2,
          recommendedMethods: [AuthenticationMethod.PASSWORD],
          requiredLevel: 4,
          requiredMethods: [AuthenticationMethod.BANK_ID_SE],
        },

        browserSessionId: browserSession.id,
        clientSessionId: clientSession.id,

        identityId: clientSession.identityId,
        redirectUri: "https://test.client.lindorm.io/redirect",
        state: randomUnreserved(16),
        status: SessionStatus.CONFIRMED,
      }),
    );

    const response = await request(server.callback())
      .get("/oauth2/sessions/elevate/verify")
      .set("Authorization", `Bearer ${accessToken.token}`)
      .set("Cookie", [
        `lindorm_io_oauth_browser_sessions=["${browserSession.id}"]; path=/; httponly`,
      ])
      .query({ session: elevationSession.id })
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
        methods: [AuthenticationMethod.BANK_ID_SE, "email", "phone"],
      }),
    );
  });
});
