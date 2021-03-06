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
} from "../../../fixtures/entity";
import {
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_CACHE,
  setupIntegration,
  getTestClientCredentials,
} from "../../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/internal/sessions/authentication", () => {
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
        authToken: "auth.jwt.jwt",
        browserSessionId: browserSession.id,
        clientId: client.id,
        identityId,
      }),
    );

    const response = await request(server.callback())
      .get(`/internal/sessions/authentication/${authorizationSession.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      authentication_required: true,
      authentication_status: "pending",
      authorization_session: {
        id: authorizationSession.id,
        display_mode: "popup",
        expires_at: "2021-01-02T08:00:00.000Z",
        expires_in: 86400,
        identity_id: identityId,
        login_hint: ["test@lindorm.io"],
        original_uri: "https://localhost/oauth2/authorize?query=query",
        prompt_modes: ["login", "consent"],
        ui_locales: ["sv-SE", "en-GB"],
      },
      browser_session: {
        amr_values: ["email_otp", "phone_otp"],
        country: "se",
        identity_id: identityId,
        level_of_assurance: 2,
        remember: true,
      },
      client: {
        description: "Client description",
        logo_uri: "https://logo.uri/logo",
        name: "ClientName",
        type: "confidential",
      },
      requested: {
        country: "se",
        auth_token: "auth.jwt.jwt",
        authentication_methods: ["email_otp", "phone_otp"],
        level_of_assurance: 2,
      },
    });
  });

  test("PUT /:id/authenticate/confirm", async () => {
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
        acrValues: [],
        amrValues: [],
        identityId: null,
        latestAuthentication: null,
        levelOfAssurance: 0,
      }),
    );

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        clientId: client.id,
        browserSessionId: browserSession.id,
      }),
    );

    const response = await request(server.callback())
      .put(`/internal/sessions/authentication/${authorizationSession.id}/confirm`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        acr_values: ["loa_2"],
        amr_values: ["email_otp", "phone_otp"],
        identity_id: identityId,
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

  test("PUT /:id/authenticate/reject", async () => {
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
      .put(`/internal/sessions/authentication/${authorizationSession.id}/reject`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      redirect_to:
        "https://test.client.lindorm.io/redirect?error=request_rejected&error_description=authentication_rejected&state=9auMwEmvzbGrWJG5853OGpAGKQrHKzgX",
    });
  });

  test("PUT /:id/authenticate/skip", async () => {
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
        acrValues: ["loa_2"],
        amrValues: ["email_otp", "phone_otp"],
        country: "se",
        identityId,
        latestAuthentication: new Date(),
        levelOfAssurance: 2,
      }),
    );

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        browserSessionId: browserSession.id,
        clientId: client.id,
        country: "se",
        identityId,
        promptModes: [],
      }),
    );

    const response = await request(server.callback())
      .put(`/internal/sessions/authentication/${authorizationSession.id}/skip`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    const url = new URL(response.body.redirect_to);

    expect(url.origin).toBe("https://oauth.test.lindorm.io");
    expect(url.pathname).toBe("/oauth2/sessions/authorize/verify");
    expect(url.searchParams.get("session_id")).toBe(authorizationSession.id);
    expect(url.searchParams.get("redirect_uri")).toBe(authorizationSession.redirectUri);
  });
});
