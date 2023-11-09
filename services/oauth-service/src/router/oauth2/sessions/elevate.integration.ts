import {
  AuthenticationFactor,
  AuthenticationLevel,
  AuthenticationMethod,
  AuthenticationStrategy,
  SessionStatus,
} from "@lindorm-io/common-enums";
import { createOpaqueToken } from "@lindorm-io/jwt";
import { randomUnreserved } from "@lindorm-io/random";
import MockDate from "mockdate";
import request from "supertest";
import { ClientSessionType } from "../../../enum";
import { getTestData } from "../../../fixtures/data";
import {
  createTestAccessToken,
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
  createTestElevationSession,
} from "../../../fixtures/entity";
import {
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_REPOSITORY,
  TEST_CLIENT_SESSION_REPOSITORY,
  TEST_ELEVATION_SESSION_CACHE,
  TEST_OPAQUE_TOKEN_CACHE,
  getTestIdToken,
  setupIntegration,
} from "../../../fixtures/integration";
import { configuration } from "../../../server/configuration";
import { server } from "../../../server/server";

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

    const opaqueToken = createOpaqueToken();
    await TEST_OPAQUE_TOKEN_CACHE.create(
      createTestAccessToken({
        id: opaqueToken.id,
        clientSessionId: clientSession.id,
        signature: opaqueToken.signature,
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
        acr_values: [
          AuthenticationLevel.LOA_3,
          AuthenticationFactor.PHISHING_RESISTANT,
          AuthenticationMethod.PASSWORD,
          AuthenticationStrategy.TIME_BASED_OTP,
        ].join(" "),
        client_id: client.id,
        id_token_hint: idToken,
        redirect_uri: "https://test.client.lindorm.io/redirect",
        state,
        ui_locales: ["sv-SE", "en-GB"].join(" "),
      })
      .set("Authorization", `Bearer ${opaqueToken.token}`)
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
          factors: [],
          latestAuthentication: null,
          levelOfAssurance: 0,
          metadata: {},
          methods: [],
          strategies: [],
        },
        country: null,
        displayMode: "page",
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: idToken,
        identityId: clientSession.identityId,
        nonce: expect.any(String),
        redirectUri: "https://test.client.lindorm.io/redirect",
        requestedAuthentication: {
          factors: ["urn:lindorm:auth:acr:phr"],
          levelOfAssurance: 3,
          methods: ["urn:lindorm:auth:method:password"],
          minimumLevelOfAssurance: 1,
          strategies: ["urn:lindorm:auth:strategy:time-based-otp"],
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

    const opaqueToken = createOpaqueToken();
    await TEST_OPAQUE_TOKEN_CACHE.create(
      createTestAccessToken({
        id: opaqueToken.id,
        clientSessionId: clientSession.id,
        signature: opaqueToken.signature,
      }),
    );

    const response = await request(server.callback())
      .post("/oauth2/sessions/elevate")
      .set("Authorization", `Bearer ${opaqueToken.token}`)
      .send({
        authentication_hint: ["email@lindorm.io"],
        client_id: client.id,
        country: "se",
        factors: [AuthenticationFactor.PHISHING_RESISTANT_HARDWARE],
        level_of_assurance: 4,
        methods: [AuthenticationMethod.BANK_ID_SE],
        nonce: "QxEQ4H21R-gslTwr",
        strategies: [AuthenticationStrategy.BANK_ID_SE],
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
          factors: [],
          latestAuthentication: null,
          levelOfAssurance: 0,
          metadata: {},
          methods: [],
          strategies: [],
        },
        country: "se",
        displayMode: "page",
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: null,
        identityId: clientSession.identityId,
        nonce: "QxEQ4H21R-gslTwr",
        redirectUri: null,
        requestedAuthentication: {
          factors: ["urn:lindorm:auth:acr:phrh"],
          levelOfAssurance: 4,
          methods: ["urn:lindorm:auth:method:bank-id-se"],
          minimumLevelOfAssurance: 1,
          strategies: ["urn:lindorm:auth:strategy:bank-id-se"],
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

    const opaqueToken = createOpaqueToken();
    await TEST_OPAQUE_TOKEN_CACHE.create(
      createTestAccessToken({
        id: opaqueToken.id,
        clientSessionId: clientSession.id,
        signature: opaqueToken.signature,
      }),
    );

    const elevationSession = await TEST_ELEVATION_SESSION_CACHE.create(
      createTestElevationSession({
        confirmedAuthentication: {
          factors: [
            AuthenticationFactor.TWO_FACTOR,
            AuthenticationFactor.PHISHING_RESISTANT_HARDWARE,
          ],
          latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
          levelOfAssurance: 4,
          metadata: {},
          methods: [AuthenticationMethod.BANK_ID_SE],
          strategies: [AuthenticationStrategy.BANK_ID_SE],
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
      .set("Authorization", `Bearer ${opaqueToken.token}`)
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
        factors: ["urn:lindorm:auth:acr:2fa", "urn:lindorm:auth:acr:phrh"],
        methods: [
          "urn:lindorm:auth:method:bank-id-se",
          "urn:lindorm:auth:method:email",
          "urn:lindorm:auth:method:phone",
        ],
        strategies: [
          "urn:lindorm:auth:strategy:bank-id-se",
          "urn:lindorm:auth:strategy:email-code",
          "urn:lindorm:auth:strategy:phone-otp",
        ],
      }),
    );
  });
});
