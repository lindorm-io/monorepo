import MockDate from "mockdate";
import request from "supertest";
import { configuration } from "../../../server/configuration";
import { server } from "../../../server/server";
import {
  createTestAccessSession,
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestRefreshSession,
} from "../../../fixtures/entity";
import {
  TEST_ACCESS_SESSION_REPOSITORY,
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_REPOSITORY,
  TEST_REFRESH_SESSION_REPOSITORY,
  getTestClientCredentials,
  setupIntegration,
} from "../../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/internal/sessions/authorization", () => {
  beforeAll(setupIntegration);

  test("should resolve data", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());
    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const accessSession = await TEST_ACCESS_SESSION_REPOSITORY.create(
      createTestAccessSession({
        audiences: ["6f49f573-1949-4173-aa0b-52cb6431e20c"],
        clientId: client.id,
        identityId: browserSession.identityId,
      }),
    );
    const refreshSession = await TEST_REFRESH_SESSION_REPOSITORY.create(
      createTestRefreshSession({
        audiences: ["4b697e26-2bcf-48ee-9949-c973eb59f552"],
        clientId: client.id,
        identityId: browserSession.identityId,
      }),
    );

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        requestedConsent: {
          audiences: ["0d51b830-1c22-4eea-95cf-209505626d63"],
          scopes: ["openid", "phone", "profile"],
        },
        requestedLogin: {
          identityId: browserSession.identityId,
          minimumLevel: 2,
          recommendedLevel: 2,
          recommendedMethods: ["email"],
          requiredLevel: 3,
          requiredMethods: ["email", "phone"],
        },
        requestedSelectAccount: {
          browserSessions: [
            {
              browserSessionId: browserSession.id,
              identityId: browserSession.identityId,
            },
          ],
        },

        accessSessionId: accessSession.id,
        authToken: "auth.jwt.jwt",
        browserSessionId: browserSession.id,
        clientId: client.id,
        nonce: "fQUsgtHGmWCwmCCZ",
        refreshSessionId: refreshSession.id,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const response = await request(server.callback())
      .get(`/internal/sessions/authorization/${authorizationSession.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      consent: {
        audiences: ["0d51b830-1c22-4eea-95cf-209505626d63"],
        is_required: true,
        scopes: ["openid", "phone", "profile"],
      },
      login: {
        identity_id: browserSession.identityId,
        is_required: true,
        minimum_level: 2,
        recommended_level: 2,
        recommended_methods: ["email"],
        required_level: 3,
        required_methods: ["email", "phone"],
      },
      select_account: {
        is_required: true,
        sessions: [
          {
            identity_id: browserSession.identityId,
            select_id: browserSession.id,
          },
        ],
      },

      access_session: {
        adjusted_access_level: 2,
        audiences: ["6f49f573-1949-4173-aa0b-52cb6431e20c"],
        identity_id: accessSession.identityId,
        latest_authentication: "2021-01-01T07:59:00.000Z",
        level_of_assurance: 2,
        methods: ["email", "phone"],
        scopes: ["openid", "profile"],
      },
      authorization_session: {
        auth_token: "auth.jwt.jwt",
        country: "se",
        display_mode: "popup",
        expires_at: "2021-01-02T08:00:00.000Z",
        expires_in: 86400,
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
        adjusted_access_level: 2,
        identity_id: browserSession.identityId,
        latest_authentication: "2021-01-01T07:59:00.000Z",
        level_of_assurance: 2,
        methods: ["email", "phone"],
        remember: true,
        sso: true,
      },
      client: {
        description: "Client description",
        logo_uri: "https://logo.uri/logo",
        name: "ClientName",
        required_scopes: ["offline_access", "openid"],
        scope_descriptions: [
          {
            description: "Give the client access to your OpenID claims.",
            name: "openid",
          },
          {
            description: "Give the client access to your profile information.",
            name: "profile",
          },
        ],
        type: "confidential",
      },
      refresh_session: {
        adjusted_access_level: 2,
        audiences: ["4b697e26-2bcf-48ee-9949-c973eb59f552"],
        identity_id: refreshSession.identityId,
        latest_authentication: "2021-01-01T07:59:00.000Z",
        level_of_assurance: 2,
        methods: ["email", "phone"],
        scopes: ["openid", "profile"],
      },
    });
  });
});
