import MockDate from "mockdate";
import request from "supertest";
import { configuration } from "../../../server/configuration";
import { randomUUID } from "crypto";
import { server } from "../../../server/server";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
} from "../../../fixtures/entity";
import {
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_CACHE,
  getTestClientCredentials,
  setupIntegration,
} from "../../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/internal/sessions/login", () => {
  beforeAll(setupIntegration);

  test("should resolve data", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        authToken: "auth.jwt.jwt",
        clientId: client.id,
        identifiers: {
          browserSessionId: browserSession.id,
          consentSessionId: null,
          refreshSessionId: null,
        },
      }),
    );

    const response = await request(server.callback())
      .get(`/internal/sessions/login/${authorizationSession.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      authorization_session: {
        id: authorizationSession.id,
        auth_token: "auth.jwt.jwt",
        country: "se",
        display_mode: "popup",
        expires_at: "2021-01-02T08:00:00.000Z",
        expires_in: 86400,
        login_hint: ["test@lindorm.io"],
        nonce: authorizationSession.nonce,
        original_uri: "https://localhost/oauth2/authorize?query=query",
        prompt_modes: ["login", "consent"],
        ui_locales: ["sv-SE", "en-GB"],
      },
      browser_session: {
        amr_values: ["email", "phone"],
        country: "se",
        identity_id: browserSession.identityId,
        level_of_assurance: 2,
        remember: true,
      },
      client: {
        description: "Client description",
        logo_uri: "https://logo.uri/logo",
        name: "ClientName",
        type: "confidential",
      },
      login_required: true,
      login_status: "pending",
      requested: {
        authentication_methods: ["email", "phone"],
        identity_id: authorizationSession.requestedLogin.identityId,
        level_hint: 2,
        level_of_assurance: 3,
        method_hint: ["email"],
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
        clientId: client.id,
      }),
    );

    const response = await request(server.callback())
      .post(`/internal/sessions/login/${authorizationSession.id}/confirm`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        acr_values: ["loa_2"],
        amr_values: ["email_otp", "phone_otp"],
        identity_id: randomUUID(),
        level_of_assurance: 2,
        remember: true,
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
      .post(`/internal/sessions/login/${authorizationSession.id}/reject`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    const url = new URL(response.body.redirect_to);

    expect(url.origin).toBe("https://test.client.lindorm.io");
    expect(url.pathname).toBe("/redirect");
    expect(url.searchParams.get("error")).toBe("request_rejected");
    expect(url.searchParams.get("error_description")).toBe("login_rejected");
    expect(url.searchParams.get("state")).toBe(authorizationSession.state);
  });
});
