import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { ClientType } from "../../../common";
import { server } from "../../../server/server";
import { randomUUID } from "crypto";
import {
  getTestClient,
  getTestConsentSession,
  getTestBrowserSession,
  getTestLogoutSession,
} from "../../../test/entity";
import {
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_CACHE,
  TEST_CONSENT_SESSION_REPOSITORY,
  TEST_LOGOUT_SESSION_CACHE,
  getTestClientCredentials,
  setupIntegration,
} from "../../../test/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/internal/sessions/logout", () => {
  beforeAll(setupIntegration);

  nock("https://test.client.lindorm.io").post("/logout/back-channel").times(999).reply(200);

  test("GET /:id", async () => {
    const client = await TEST_CLIENT_CACHE.create(
      getTestClient({
        type: ClientType.CONFIDENTIAL,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [client.id],
      subject: client.id,
    });

    const consentSession = await TEST_CONSENT_SESSION_REPOSITORY.create(
      getTestConsentSession({
        audiences: [client.id],
        clientId: client.id,
        identityId: randomUUID(),
        scopes: ["openid"],
      }),
    );

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      getTestBrowserSession({
        identityId: consentSession.identityId,
      }),
    );

    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(
      getTestLogoutSession({
        clientId: client.id,
        sessionId: browserSession.id,
      }),
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

  test("PUT /:id/confirm", async () => {
    const client = await TEST_CLIENT_CACHE.create(
      getTestClient({
        type: ClientType.CONFIDENTIAL,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [client.id],
      subject: client.id,
    });

    const consentSession = await TEST_CONSENT_SESSION_REPOSITORY.create(
      getTestConsentSession({
        audiences: [client.id],
        clientId: client.id,
        identityId: randomUUID(),
        scopes: ["openid"],
      }),
    );

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      getTestBrowserSession({
        clients: [client.id],
        identityId: consentSession.identityId,
      }),
    );

    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(
      getTestLogoutSession({
        clientId: client.id,
        sessionId: browserSession.id,
      }),
    );

    const response = await request(server.callback())
      .put(`/internal/sessions/logout/${logoutSession.id}/confirm`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    const url = new URL(response.body.redirect_to);

    expect(url.origin).toBe("https://oauth.test.lindorm.io");
    expect(url.pathname).toBe("/oauth2/sessions/logout/verify");
    expect(url.searchParams.get("session_id")).toStrictEqual(logoutSession.id);
    expect(url.searchParams.get("redirect_uri")).toStrictEqual(logoutSession.redirectUri);
  });

  test("PUT /:id/reject", async () => {
    const client = await TEST_CLIENT_CACHE.create(
      getTestClient({
        type: ClientType.CONFIDENTIAL,
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [client.id],
      subject: client.id,
    });

    const consentSession = await TEST_CONSENT_SESSION_REPOSITORY.create(
      getTestConsentSession({
        audiences: [client.id],
        clientId: client.id,
        identityId: randomUUID(),
        scopes: ["openid"],
      }),
    );

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(
      getTestBrowserSession({
        identityId: consentSession.identityId,
      }),
    );

    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(
      getTestLogoutSession({
        clientId: client.id,
        sessionId: browserSession.id,
      }),
    );

    const response = await request(server.callback())
      .put(`/internal/sessions/logout/${logoutSession.id}/reject`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      redirect_to:
        "https://test.client.lindorm.io/redirect?error=request_rejected&error_description=logout_rejected&state=YuTs0Kaf8UV1I086TptUqz1Yh1PNoJow",
    });
  });
});
