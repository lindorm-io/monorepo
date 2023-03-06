import MockDate from "mockdate";
import request from "supertest";
import { configuration } from "../../../server/configuration";
import { randomUUID } from "crypto";
import { server } from "../../../server/server";
import {
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
  createTestLogoutSession,
  createTestTenant,
} from "../../../fixtures/entity";
import {
  getTestClientCredentials,
  setupIntegration,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_REPOSITORY,
  TEST_CLIENT_SESSION_REPOSITORY,
  TEST_LOGOUT_SESSION_CACHE,
  TEST_TENANT_REPOSITORY,
} from "../../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/admin/sessions/logout", () => {
  beforeAll(setupIntegration);

  test("should resolve data", async () => {
    const tenant = await TEST_TENANT_REPOSITORY.create(createTestTenant());
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient({ tenantId: tenant.id }));

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        browserSessionId: browserSession.id,
        clientId: client.id,
      }),
    );

    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(
      createTestLogoutSession({
        requestedLogout: {
          browserSessionId: browserSession.id,
          clientSessionId: clientSession.id,
        },
        clientId: client.id,
      }),
    );

    const response = await request(server.callback())
      .get(`/admin/sessions/logout/${logoutSession.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      logout: {
        status: "pending",

        browser_session: {
          id: browserSession.id,
          connected_sessions: 0,
        },
        client_session: {
          id: clientSession.id,
        },
      },

      logout_session: {
        id: logoutSession.id,
        expires: "2021-01-02T08:00:00.000Z",
        id_token_hint: "jwt.jwt.jwt",
        identity_id: logoutSession.identityId,
        logout_hint: "logout-hint",
        original_uri: "https://localhost/oauth2/sessions/logout?query=query",
        ui_locales: ["en-GB"],
      },

      client: {
        id: client.id,
        name: "ClientName",
        logo_uri: "https://logo.uri/logo",
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

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(
      createTestLogoutSession({ clientId: client.id }),
    );

    const response = await request(server.callback())
      .post(`/admin/sessions/logout/${logoutSession.id}/confirm`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        browser_session_id: randomUUID(),
        client_session_id: randomUUID(),
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
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(
      createTestLogoutSession({ clientId: client.id }),
    );

    const response = await request(server.callback())
      .post(`/admin/sessions/logout/${logoutSession.id}/reject`)
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
