import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { server } from "../../server/server";
import { setupIntegration } from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessions/logout", () => {
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
    .get("/internal/sessions/logout/1a0777b1-5074-4d1c-9958-2b231ba910ff")
    .times(999)
    .reply(200, {
      logout_status: "pending",
      client: {
        name: "name",
        description: "description",
        logo_uri: "https://client.logo.uri/",
      },
    });

  nock("https://oauth.test.lindorm.io")
    .post("/internal/sessions/logout/1a0777b1-5074-4d1c-9958-2b231ba910ff/confirm")
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

  nock("https://oauth.test.lindorm.io")
    .post("/internal/sessions/logout/1a0777b1-5074-4d1c-9958-2b231ba910ff/reject")
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-reject.url/",
    });

  test("should resolve logout session data", async () => {
    const response = await request(server.callback())
      .get("/sessions/logout/1a0777b1-5074-4d1c-9958-2b231ba910ff")
      .expect(200);

    expect(response.body).toStrictEqual({
      client: {
        description: "description",
        logo_uri: "https://client.logo.uri/",
        name: "name",
      },
      status: "pending",
    });
  });

  test("should confirm and redirect", async () => {
    const response = await request(server.callback())
      .post("/sessions/logout/1a0777b1-5074-4d1c-9958-2b231ba910ff/confirm")
      .expect(200);

    expect(response.body).toStrictEqual({
      redirect_to: "https://oauth-redirect-confirm.url/",
    });
  });

  test("should reject and redirect", async () => {
    const response = await request(server.callback())
      .post("/sessions/logout/1a0777b1-5074-4d1c-9958-2b231ba910ff/reject")
      .expect(200);

    expect(response.body).toStrictEqual({
      redirect_to: "https://oauth-redirect-reject.url/",
    });
  });
});
