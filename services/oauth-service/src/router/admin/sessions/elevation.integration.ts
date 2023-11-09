import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
import MockDate from "mockdate";
import request from "supertest";
import {
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
  createTestElevationSession,
  createTestTenant,
} from "../../../fixtures/entity";
import {
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_REPOSITORY,
  TEST_CLIENT_SESSION_REPOSITORY,
  TEST_ELEVATION_SESSION_CACHE,
  TEST_TENANT_REPOSITORY,
  getTestClientCredentials,
  setupIntegration,
} from "../../../fixtures/integration";
import { configuration } from "../../../server/configuration";
import { server } from "../../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/admin/sessions/elevation", () => {
  beforeAll(setupIntegration);

  test("should resolve data", async () => {
    const tenant = await TEST_TENANT_REPOSITORY.create(createTestTenant());
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient({ tenantId: tenant.id }));
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        audiences: ["4b697e26-2bcf-48ee-9949-c973eb59f552"],
        clientId: client.id,
        identityId: browserSession.identityId,
      }),
    );

    const elevationSession = await TEST_ELEVATION_SESSION_CACHE.create(
      createTestElevationSession({
        requestedAuthentication: {
          levelOfAssurance: 3,
          factors: [AuthenticationFactor.TWO_FACTOR],
          methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
          minimumLevelOfAssurance: 2,
          strategies: [AuthenticationStrategy.PHONE_OTP],
        },

        browserSessionId: browserSession.id,
        clientId: client.id,
        nonce: "fQUsgtHGmWCwmCCZ",
        clientSessionId: clientSession.id,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const response = await request(server.callback())
      .get(`/admin/sessions/elevation/${elevationSession.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      elevation: {
        is_required: true,
        status: "pending",

        factors: ["urn:lindorm:auth:acr:2fa"],
        level_of_assurance: 3,
        methods: ["urn:lindorm:auth:method:email", "urn:lindorm:auth:method:phone"],
        minimum_level_of_assurance: 2,
        strategies: ["urn:lindorm:auth:strategy:phone-otp"],
      },

      elevation_session: {
        id: elevationSession.id,
        authentication_hint: ["test@lindorm.io"],
        country: "se",
        display_mode: "page",
        expires: "2021-01-02T08:00:00.000Z",
        id_token_hint: "id.jwt.jwt",
        identity_id: elevationSession.identityId,
        nonce: "fQUsgtHGmWCwmCCZ",
        ui_locales: ["sv-SE", "en-GB"],
      },

      browser_session: {
        id: browserSession.id,
        adjusted_access_level: 2,
        factors: ["urn:lindorm:auth:acr:2fa"],
        identity_id: browserSession.identityId,
        latest_authentication: "2021-01-01T07:59:00.000Z",
        level_of_assurance: 2,
        methods: ["urn:lindorm:auth:method:email", "urn:lindorm:auth:method:phone"],
        remember: true,
        single_sign_on: true,
        strategies: ["urn:lindorm:auth:strategy:email-code", "urn:lindorm:auth:strategy:phone-otp"],
      },

      client_session: {
        id: clientSession.id,
        adjusted_access_level: 2,
        audiences: [expect.any(String)],
        factors: ["urn:lindorm:auth:acr:2fa"],
        identity_id: clientSession.identityId,
        latest_authentication: "2021-01-01T07:59:00.000Z",
        level_of_assurance: 2,
        methods: ["urn:lindorm:auth:method:email", "urn:lindorm:auth:method:phone"],
        scopes: ["openid", "profile"],
        strategies: ["urn:lindorm:auth:strategy:email-code", "urn:lindorm:auth:strategy:phone-otp"],
      },

      client: {
        id: client.id,
        name: "ClientName",
        logo_uri: "https://logo.uri/logo",
        single_sign_on: true,
        type: "confidential",
      },

      tenant: {
        id: tenant.id,
        name: "TenantName",
      },
    });
  });

  test("should confirm and resolve redirect uri", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());
    const elevationSession = await TEST_ELEVATION_SESSION_CACHE.create(
      createTestElevationSession({
        clientId: client.id,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const response = await request(server.callback())
      .post(`/admin/sessions/elevation/${elevationSession.id}/confirm`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        factors: [AuthenticationFactor.ONE_FACTOR],
        identity_id: elevationSession.identityId,
        level_of_assurance: 4,
        metadata: {},
        methods: [AuthenticationMethod.EMAIL],
        strategies: [AuthenticationStrategy.EMAIL_CODE],
      })
      .expect(200);

    const url = new URL(response.body.redirect_to);

    expect(url.origin).toBe("https://oauth.test.lindorm.io");
    expect(url.pathname).toBe("/oauth2/sessions/elevate/verify");
    expect(url.searchParams.get("session")).toBe(elevationSession.id);
    expect(url.searchParams.get("redirect_uri")).toBe(elevationSession.redirectUri);
  });

  test("should reject and resolve redirect uri", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const elevationSession = await TEST_ELEVATION_SESSION_CACHE.create(
      createTestElevationSession({ clientId: client.id }),
    );

    const response = await request(server.callback())
      .post(`/admin/sessions/elevation/${elevationSession.id}/reject`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    const url = new URL(response.body.redirect_to);

    expect(url.origin).toBe("https://test.client.lindorm.io");
    expect(url.pathname).toBe("/redirect");
    expect(url.searchParams.get("error")).toBe("request_rejected");
    expect(url.searchParams.get("error_description")).toBe("elevation_rejected");
    expect(url.searchParams.get("state")).toBe(elevationSession.state);
  });
});
