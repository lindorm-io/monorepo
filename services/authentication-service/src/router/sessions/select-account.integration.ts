import { randomUUID } from "crypto";
import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { mockFetchOauthAuthorizationSession } from "../../fixtures/axios";
import { setupIntegration } from "../../fixtures/integration";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessions/consent", () => {
  beforeAll(setupIntegration);

  nock("https://oauth.test.lindorm.io")
    .get("/.well-known/openid-configuration")
    .times(999)
    .reply(200, {
      token_endpoint: "https://oauth.test.lindorm.io/oauth2/token",
    });

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      access_token: "accessToken",
      expires_in: 100,
      scope: ["scope"],
    });

  nock("https://oauth.test.lindorm.io")
    .get((url) => url.startsWith("/admin/sessions/authorization/"))
    .times(999)
    .reply(200, mockFetchOauthAuthorizationSession());

  nock("https://oauth.test.lindorm.io")
    .post("/admin/sessions/select-account/87fe3e05-44b8-44bf-ab93-656001d14fc6/confirm")
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

  nock("https://oauth.test.lindorm.io")
    .post("/admin/sessions/select-account/87fe3e05-44b8-44bf-ab93-656001d14fc6/reject")
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-reject.url/",
    });

  test("should resolve consent session data", async () => {
    const response = await request(server.callback())
      .get("/sessions/select-account/87fe3e05-44b8-44bf-ab93-656001d14fc6")
      .expect(200);

    expect(response.body).toStrictEqual({
      sessions: [
        {
          identity_id: expect.any(String),
          select_id: expect.any(String),
        },
        {
          identity_id: expect.any(String),
          select_id: expect.any(String),
        },
      ],
      status: "pending",
      client: {
        id: expect.any(String),
        logo_uri: "https://test.client.com/logo.png",
        name: "Test Client",
        single_sign_on: true,
        type: "public",
      },
      tenant: {
        id: expect.any(String),
        name: "Test Tenant",
      },
    });
  });

  test("should confirm and redirect with existing", async () => {
    const response = await request(server.callback())
      .post("/sessions/select-account/87fe3e05-44b8-44bf-ab93-656001d14fc6/confirm")
      .send({
        select_existing: randomUUID(),
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      redirect_to: "https://oauth-redirect-confirm.url/",
    });
  });

  test("should confirm and redirect", async () => {
    const response = await request(server.callback())
      .post("/sessions/select-account/87fe3e05-44b8-44bf-ab93-656001d14fc6/confirm")
      .send({
        select_new: true,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      redirect_to: "https://oauth-redirect-confirm.url/",
    });
  });

  test("should reject and redirect", async () => {
    const response = await request(server.callback())
      .post("/sessions/select-account/87fe3e05-44b8-44bf-ab93-656001d14fc6/reject")
      .expect(200);

    expect(response.body).toStrictEqual({
      redirect_to: "https://oauth-redirect-reject.url/",
    });
  });
});
