import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { server } from "../../server/server";
import { setupIntegration } from "../../fixtures/integration";
import { mockFetchOauthAuthorizationSession } from "../../fixtures/axios";

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
    .post("/admin/sessions/consent/87fe3e05-44b8-44bf-ab93-656001d14fc6/confirm")
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

  nock("https://oauth.test.lindorm.io")
    .post("/admin/sessions/consent/87fe3e05-44b8-44bf-ab93-656001d14fc6/reject")
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-reject.url/",
    });

  test("should resolve consent session data", async () => {
    const response = await request(server.callback())
      .get("/sessions/consent/87fe3e05-44b8-44bf-ab93-656001d14fc6")
      .expect(200);

    expect(response.body).toStrictEqual({
      audiences: [expect.any(String)],
      client: {
        logo_uri: "https://test.client.com/logo.png",
        name: "Test Client",
        tenant: "Test Tenant",
        type: "public",
      },
      optional_scopes: [
        "accessibility",
        "national_identity_number",
        "public",
        "social_security_number",
        "username",
      ],
      required_scopes: ["address", "email", "offline_access", "openid", "phone", "profile"],
      scope_descriptions: [],
      status: "pending",
    });
  });

  test("should confirm and redirect", async () => {
    const response = await request(server.callback())
      .post("/sessions/consent/87fe3e05-44b8-44bf-ab93-656001d14fc6/confirm")
      .send({
        audiences: ["787ea457-83ce-4e25-b3a5-32484e59426a"],
        scopes: ["openid", "profile", "phone"],
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      redirect_to: "https://oauth-redirect-confirm.url/",
    });
  });

  test("should reject and redirect", async () => {
    const response = await request(server.callback())
      .post("/sessions/consent/87fe3e05-44b8-44bf-ab93-656001d14fc6/reject")
      .expect(200);

    expect(response.body).toStrictEqual({
      redirect_to: "https://oauth-redirect-reject.url/",
    });
  });
});
