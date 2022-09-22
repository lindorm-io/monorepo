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

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/internal/sessions/logout", () => {
  beforeAll(setupIntegration);

  test("should resolve consent data", async () => {
    const client = await TEST_CLIENT_CACHE.create(createTestClient());

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(
      createTestLogoutSession({ clientId: client.id }),
    );

    const response = await request(server.callback())
      .get(`/internal/sessions/logout/${logoutSession.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      client: {
        description: "Client description",
        logo_uri: "https://logo.uri/logo",
        name: "ClientName",
        type: "confidential",
      },
      logout_session: {
        id: logoutSession.id,
        expires_at: "2021-01-02T08:00:00.000Z",
        expires_in: 86400,
        original_uri: "https://localhost/oauth2/sessions/logout?query=query",
      },
      logout_status: "pending",
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
      .expect(200);

    const url = new URL(response.body.redirect_to);

    expect(url.origin).toBe("https://oauth.test.lindorm.io");
    expect(url.pathname).toBe("/oauth2/sessions/logout/verify");
    expect(url.searchParams.get("session_id")).toStrictEqual(logoutSession.id);
    expect(url.searchParams.get("redirect_uri")).toStrictEqual(logoutSession.redirectUri);
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
    expect(url.pathname).toBe("/redirect");
    expect(url.searchParams.get("error")).toBe("request_rejected");
    expect(url.searchParams.get("error_description")).toBe("logout_rejected");
    expect(url.searchParams.get("state")).toBe(logoutSession.state);
  });
});
