import MockDate from "mockdate";
import request from "supertest";
import { configuration } from "../../../server/configuration";
import { createTestClient, createTestLogoutSession } from "../../../fixtures/entity";
import { server } from "../../../server/server";
import {
  TEST_CLIENT_CACHE,
  TEST_LOGOUT_SESSION_CACHE,
  getTestClientCredentials,
  setupIntegration,
} from "../../../fixtures/integration";
import { randomUUID } from "crypto";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/internal/sessions/logout", () => {
  beforeAll(setupIntegration);

  test("should resolve data", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(
      createTestLogoutSession({
        requestedLogout: {
          accessSessionId: "7a00f104-79e6-4f79-ae3d-d1ac31cfb1d6",
          accessSessions: ["7a00f104-79e6-4f79-ae3d-d1ac31cfb1d6"],
          browserSessionId: "7efdec2b-c155-4a8b-ac2b-e47e6e0a757d",
          refreshSessionId: null,
          refreshSessions: [],
        },
        clientId: client.id,
      }),
    );

    const response = await request(server.callback())
      .get(`/internal/sessions/logout/${logoutSession.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      logout: {
        access_session_id: "7a00f104-79e6-4f79-ae3d-d1ac31cfb1d6",
        access_sessions: ["7a00f104-79e6-4f79-ae3d-d1ac31cfb1d6"],
        browser_session_id: "7efdec2b-c155-4a8b-ac2b-e47e6e0a757d",
        refresh_session_id: null,
        refresh_sessions: [],
      },

      client: {
        description: "Client description",
        logo_uri: "https://logo.uri/logo",
        name: "ClientName",
        type: "confidential",
      },
      logout_session: {
        client_id: client.id,
        expires_at: "2021-01-02T08:00:00.000Z",
        expires_in: 86400,
        id_token_hint: "jwt.jwt.jwt",
        identity_id: logoutSession.identityId,
        logout_hint: "logout-hint",
        original_uri: "https://localhost/oauth2/sessions/logout?query=query",
        ui_locales: ["en-GB"],
      },
    });
  });

  test("should confirm and resolve redirect uri", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(
      createTestLogoutSession({ clientId: client.id }),
    );

    const response = await request(server.callback())
      .post(`/internal/sessions/logout/${logoutSession.id}/confirm`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        access_session_id: randomUUID(),
        browser_session_id: randomUUID(),
        refresh_session_id: randomUUID(),
      })
      .expect(200);

    const url = new URL(response.body.redirect_to);

    expect(url.origin).toBe("https://oauth.test.lindorm.io");
    expect(url.pathname).toBe("/oauth2/sessions/logout/verify");
    expect(url.searchParams.get("session")).toStrictEqual(logoutSession.id);
    expect(url.searchParams.get("post_logout_redirect_uri")).toStrictEqual(
      "https://test.client.lindorm.io/logout",
    );
  });

  test("should reject and resolve redirect uri", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(
      createTestLogoutSession({ clientId: client.id }),
    );

    const response = await request(server.callback())
      .post(`/internal/sessions/logout/${logoutSession.id}/reject`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    const url = new URL(response.body.redirect_to);

    expect(url.origin).toBe("https://test.client.lindorm.io");
    expect(url.pathname).toBe("/logout");
    expect(url.searchParams.get("error")).toBe("request_rejected");
    expect(url.searchParams.get("error_description")).toBe("logout_rejected");
    expect(url.searchParams.get("state")).toBe(logoutSession.state);
  });
});
