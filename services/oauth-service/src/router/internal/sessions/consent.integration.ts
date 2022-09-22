import MockDate from "mockdate";
import request from "supertest";
import { configuration } from "../../../server/configuration";
import { server } from "../../../server/server";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
} from "../../../fixtures/entity";
import {
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_CLIENT_CACHE,
  setupIntegration,
  getTestClientCredentials,
  TEST_BROWSER_SESSION_REPOSITORY,
} from "../../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/internal/sessions/consent", () => {
  beforeAll(setupIntegration);

  test("should resolve consent data", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        clientId: client.id,
        identifiers: {
          browserSessionId: browserSession.id,
          consentSessionId: null,
          refreshSessionId: null,
        },
        requestedConsent: {
          audiences: [client.id],
          scopes: ["address", "email", "offline_access", "openid", "phone", "profile"],
        },
      }),
    );

    const response = await request(server.callback())
      .get(`/internal/sessions/consent/${authorizationSession.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      authorization_session: {
        id: authorizationSession.id,
        display_mode: "popup",
        expires_at: "2021-01-02T08:00:00.000Z",
        expires_in: 86400,
        original_uri: "https://localhost/oauth2/authorize?query=query",
        prompt_modes: ["login", "consent"],
        ui_locales: ["sv-SE", "en-GB"],
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
      consent_required: true,
      consent_session: {
        audiences: [],
        scopes: [],
      },
      consent_status: "pending",
      requested: {
        audiences: [client.id],
        scopes: ["address", "email", "offline_access", "openid", "phone", "profile"],
      },
    });
  });

  test("should confirm and resolve redirect uri", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        requestedConsent: {
          audiences: [client.id],
          scopes: ["address", "email", "offline_access", "openid", "phone", "profile"],
        },
        clientId: client.id,
      }),
    );

    const response = await request(server.callback())
      .post(`/internal/sessions/consent/${authorizationSession.id}/confirm`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        audiences: authorizationSession.requestedConsent.audiences,
        scopes: authorizationSession.requestedConsent.scopes,
      })
      .expect(200);

    const url = new URL(response.body.redirect_to);

    expect(url.origin).toBe("https://oauth.test.lindorm.io");
    expect(url.pathname).toBe("/oauth2/sessions/authorize/verify");
    expect(url.searchParams.get("session_id")).toBe(authorizationSession.id);
    expect(url.searchParams.get("redirect_uri")).toBe(authorizationSession.redirectUri);
  });

  test("should reject and resolve redirect uri", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({ clientId: client.id }),
    );

    const response = await request(server.callback())
      .post(`/internal/sessions/consent/${authorizationSession.id}/reject`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    const url = new URL(response.body.redirect_to);

    expect(url.origin).toBe("https://test.client.lindorm.io");
    expect(url.pathname).toBe("/redirect");
    expect(url.searchParams.get("error")).toBe("request_rejected");
    expect(url.searchParams.get("error_description")).toBe("consent_rejected");
    expect(url.searchParams.get("state")).toBe(authorizationSession.state);
  });
});
