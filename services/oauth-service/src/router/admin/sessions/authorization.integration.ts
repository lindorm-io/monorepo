import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  OpenIdScope,
} from "@lindorm-io/common-types";
import MockDate from "mockdate";
import request from "supertest";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
  createTestTenant,
} from "../../../fixtures/entity";
import {
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_REPOSITORY,
  TEST_CLIENT_SESSION_REPOSITORY,
  TEST_TENANT_REPOSITORY,
  getTestClientCredentials,
  setupIntegration,
} from "../../../fixtures/integration";
import { configuration } from "../../../server/configuration";
import { server } from "../../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/admin/sessions/authorization", () => {
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

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        requestedConsent: {
          audiences: ["0d51b830-1c22-4eea-95cf-209505626d63"],
          scopes: [OpenIdScope.OPENID, OpenIdScope.PHONE, OpenIdScope.PROFILE],
        },
        requestedLogin: {
          factors: [AuthenticationFactor.TWO_FACTOR],
          identityId: browserSession.identityId,
          levelOfAssurance: 4,
          methods: [AuthenticationMethod.EMAIL],
          minimumLevelOfAssurance: 2,
          strategies: [AuthenticationStrategy.PHONE_OTP],
        },
        requestedSelectAccount: {
          browserSessions: [
            {
              browserSessionId: browserSession.id,
              identityId: browserSession.identityId,
            },
          ],
        },

        browserSessionId: browserSession.id,
        clientId: client.id,
        clientSessionId: clientSession.id,
        nonce: "fQUsgtHGmWCwmCCZ",
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const response = await request(server.callback())
      .get(`/admin/sessions/authorization/${authorizationSession.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      consent: {
        is_required: true,
        status: "pending",

        audiences: ["0d51b830-1c22-4eea-95cf-209505626d63"],
        optional_scopes: ["phone", "profile"],
        required_scopes: ["offline_access", "openid"],
        scope_descriptions: [
          { name: "openid", description: "Give the client access to your OpenID claims." },
          { name: "profile", description: "Give the client access to your profile information." },
        ],
      },

      login: {
        is_required: true,
        status: "pending",

        factors: ["urn:lindorm:auth:acr:2fa"],
        identity_id: browserSession.identityId,
        level_of_assurance: 4,
        methods: ["urn:lindorm:auth:method:email"],
        minimum_level_of_assurance: 2,
        strategies: ["urn:lindorm:auth:strategy:phone-otp"],
      },

      select_account: {
        is_required: true,
        status: "pending",

        sessions: [
          {
            identity_id: browserSession.identityId,
            select_id: browserSession.id,
          },
        ],
      },

      authorization_session: {
        id: authorizationSession.id,
        country: "se",
        display_mode: "popup",
        expires: "2021-01-02T08:00:00.000Z",
        id_token_hint: "id.jwt.jwt",
        login_hint: ["test@lindorm.io"],
        max_age: 999,
        nonce: "fQUsgtHGmWCwmCCZ",
        original_uri: "https://localhost/oauth2/authorize?query=query",
        prompt_modes: ["login", "consent", "select_account"],
        redirect_uri: "https://test.client.lindorm.io/redirect",
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
        audiences: ["4b697e26-2bcf-48ee-9949-c973eb59f552"],
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
});
