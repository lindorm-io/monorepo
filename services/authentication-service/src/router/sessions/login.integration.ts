import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { server } from "../../server/server";
import {
  getTestAuthenticationConfirmationToken,
  setupIntegration,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessions/login", () => {
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
    .get("/internal/sessions/login/dd23a1f5-1a31-479b-a81e-2f20945061d8")
    .times(999)
    .reply(200, {
      login_status: "pending",
      client: {
        name: "name",
        description: "description",
        logo_uri: "https://client.logo.uri/",
      },
    });

  nock("https://oauth.test.lindorm.io")
    .post("/internal/sessions/login/9937434e-aacb-489c-adc9-faa945be8145/confirm")
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

  nock("https://oauth.test.lindorm.io")
    .post("/internal/sessions/login/dd23a1f5-1a31-479b-a81e-2f20945061d8/reject")
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-reject.url/",
    });

  test("should resolve login session data", async () => {
    const response = await request(server.callback())
      .get("/sessions/login/dd23a1f5-1a31-479b-a81e-2f20945061d8")
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
    const authenticationConfirmationToken = getTestAuthenticationConfirmationToken({
      sessionId: "9937434e-aacb-489c-adc9-faa945be8145",
    });

    const response = await request(server.callback())
      .post("/sessions/login/dd23a1f5-1a31-479b-a81e-2f20945061d8/confirm")
      .send({
        authentication_confirmation_token: authenticationConfirmationToken,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      redirect_to: "https://oauth-redirect-confirm.url/",
    });
  });

  test("should reject and redirect", async () => {
    const response = await request(server.callback())
      .post("/sessions/login/dd23a1f5-1a31-479b-a81e-2f20945061d8/reject")
      .expect(200);

    expect(response.body).toStrictEqual({
      redirect_to: "https://oauth-redirect-reject.url/",
    });
  });
});
