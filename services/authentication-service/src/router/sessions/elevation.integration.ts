import { createOpaqueToken } from "@lindorm-io/jwt";
import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { mockFetchOauthElevationSession } from "../../fixtures/axios";
import { createTestAuthenticationConfirmationToken } from "../../fixtures/entity";
import {
  TEST_AUTHENTICATION_CONFIRMATION_TOKEN_CACHE,
  setupIntegration,
} from "../../fixtures/integration";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessions/elevation", () => {
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
    .get((url) => url.startsWith("/admin/sessions/elevation/"))
    .times(999)
    .reply(200, mockFetchOauthElevationSession());

  nock("https://oauth.test.lindorm.io")
    .post("/admin/sessions/elevation/9937434e-aacb-489c-adc9-faa945be8145/confirm")
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

  nock("https://oauth.test.lindorm.io")
    .post("/admin/sessions/elevation/dd23a1f5-1a31-479b-a81e-2f20945061d8/reject")
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-reject.url/",
    });

  test("should resolve elevation session data", async () => {
    const response = await request(server.callback())
      .get("/sessions/elevation/dd23a1f5-1a31-479b-a81e-2f20945061d8")
      .expect(200);

    expect(response.body).toStrictEqual({
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

  test("should confirm", async () => {
    const authenticationToken = createOpaqueToken();

    await TEST_AUTHENTICATION_CONFIRMATION_TOKEN_CACHE.create(
      createTestAuthenticationConfirmationToken({
        id: authenticationToken.id,
        sessionId: "9937434e-aacb-489c-adc9-faa945be8145",
        signature: authenticationToken.signature,
      }),
    );

    const response = await request(server.callback())
      .post("/sessions/elevation/dd23a1f5-1a31-479b-a81e-2f20945061d8/confirm")
      .send({
        token: authenticationToken.token,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      redirect_to: "https://oauth-redirect-confirm.url/",
    });
  });

  test("should reject", async () => {
    await request(server.callback())
      .post("/sessions/elevation/dd23a1f5-1a31-479b-a81e-2f20945061d8/reject")
      .expect(204);
  });
});
