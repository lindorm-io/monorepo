import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { server } from "../../server/server";
import { setupIntegration } from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessions/consent", () => {
  beforeAll(setupIntegration);

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      access_token: "accessToken",
      expires_in: 100,
      scope: ["scope"],
    });

  nock("https://oauth.test.lindorm.io")
    .get("/internal/sessions/consent/87fe3e05-44b8-44bf-ab93-656001d14fc6")
    .times(999)
    .reply(200, {
      consent_status: "pending",
      client: {
        name: "name",
        description: "description",
        logo_uri: "https://client.logo.uri/",
        required_scopes: ["openid", "profile"],
        scope_descriptions: [
          { name: "email", description: "email-description" },
          { name: "openid", description: "openid-description" },
          { name: "phone", description: "phone-description" },
          { name: "profile", description: "profile-description" },
        ],
        type: "public",
      },
      requested: {
        audiences: ["5e2eb662-15e4-4dd9-b283-f5e1c1f637f9"],
        scopes: ["email", "openid", "phone", "profile"],
      },
    });

  nock("https://oauth.test.lindorm.io")
    .post("/internal/sessions/consent/87fe3e05-44b8-44bf-ab93-656001d14fc6/confirm")
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

  nock("https://oauth.test.lindorm.io")
    .post("/internal/sessions/consent/87fe3e05-44b8-44bf-ab93-656001d14fc6/reject")
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-reject.url/",
    });

  test("should resolve consent session data", async () => {
    const response = await request(server.callback())
      .get("/sessions/consent/87fe3e05-44b8-44bf-ab93-656001d14fc6")
      .expect(200);

    expect(response.body).toStrictEqual({
      client: {
        description: "description",
        logo_uri: "https://client.logo.uri/",
        name: "name",
        required_scopes: ["openid", "profile"],
        scope_descriptions: [
          { name: "email", description: "email-description" },
          { name: "openid", description: "openid-description" },
          { name: "phone", description: "phone-description" },
          { name: "profile", description: "profile-description" },
        ],
        type: "public",
      },
      requested: {
        audiences: [expect.any(String)],
        scopes: ["email", "openid", "phone", "profile"],
      },
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
