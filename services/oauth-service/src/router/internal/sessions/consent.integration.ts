import MockDate from "mockdate";
import request from "supertest";
import { ClientType } from "../../../common";
import { configuration } from "../../../server/configuration";
import { randomUUID } from "crypto";
import { server } from "../../../server/server";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestConsentSession,
} from "../../../fixtures/entity";
import {
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_CACHE,
  TEST_CONSENT_SESSION_REPOSITORY,
  setupIntegration,
  getTestClientCredentials,
} from "../../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/internal/sessions/consent", () => {
  beforeAll(setupIntegration);

  test("GET /:id", async () => {
    const identityId = randomUUID();

    const client = await TEST_CLIENT_CACHE.create(
      createTestClient({
        type: ClientType.CONFIDENTIAL,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      createTestBrowserSession({ identityId }),
    );

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        audiences: [configuration.oauth.client_id, client.id],
        browserSessionId: browserSession.id,
        clientId: client.id,
        identityId,
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
        audiences: [configuration.oauth.client_id, client.id],
        scopes: ["address", "email", "offline_access", "openid", "phone", "profile"],
      },
    });
  });

  test("PUT /:id/consent/confirm", async () => {
    const identityId = randomUUID();

    const client = await TEST_CLIENT_CACHE.create(
      createTestClient({
        type: ClientType.CONFIDENTIAL,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      createTestBrowserSession({
        identityId,
      }),
    );

    const consentSession = await TEST_CONSENT_SESSION_REPOSITORY.create(
      createTestConsentSession({
        audiences: [],
        clientId: client.id,
        identityId,
        scopes: [],
        sessions: [],
      }),
    );

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        browserSessionId: browserSession.id,
        clientId: client.id,
        consentSessionId: consentSession.id,
        identityId,
      }),
    );

    const response = await request(server.callback())
      .put(`/internal/sessions/consent/${authorizationSession.id}/confirm`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        audiences: [configuration.oauth.client_id, client.id],
        scopes: authorizationSession.scopes,
      })
      .expect(200);

    const url = new URL(response.body.redirect_to);

    expect(url.origin).toBe("https://oauth.test.lindorm.io");
    expect(url.pathname).toBe("/oauth2/sessions/authorize/verify");
    expect(url.searchParams.get("session_id")).toBe(authorizationSession.id);
    expect(url.searchParams.get("redirect_uri")).toBe(authorizationSession.redirectUri);
  });

  test("PUT /:id/consent/reject", async () => {
    const client = await TEST_CLIENT_CACHE.create(
      createTestClient({
        type: ClientType.CONFIDENTIAL,
      }),
    );

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
      .put(`/internal/sessions/consent/${authorizationSession.id}/reject`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      redirect_to:
        "https://test.client.lindorm.io/redirect?error=request_rejected&error_description=consent_rejected&state=9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });
  });

  test("PUT /:id/consent/skip", async () => {
    const identityId = randomUUID();

    const client = await TEST_CLIENT_CACHE.create(
      createTestClient({
        type: ClientType.CONFIDENTIAL,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      createTestBrowserSession({
        identityId,
      }),
    );

    const consentSession = await TEST_CONSENT_SESSION_REPOSITORY.create(
      createTestConsentSession({
        audiences: [configuration.oauth.client_id, client.id],
        clientId: client.id,
        identityId,
        scopes: ["address", "email", "offline_access", "openid", "phone", "profile"],
        sessions: [],
      }),
    );

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        browserSessionId: browserSession.id,
        clientId: client.id,
        consentSessionId: consentSession.id,
        identityId,
      }),
    );

    const response = await request(server.callback())
      .put(`/internal/sessions/consent/${authorizationSession.id}/skip`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    const url = new URL(response.body.redirect_to);

    expect(url.origin).toBe("https://oauth.test.lindorm.io");
    expect(url.pathname).toBe("/oauth2/sessions/authorize/verify");
    expect(url.searchParams.get("session_id")).toBe(authorizationSession.id);
    expect(url.searchParams.get("redirect_uri")).toBe(authorizationSession.redirectUri);
  });
});
