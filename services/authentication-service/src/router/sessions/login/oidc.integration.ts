import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { createTestLoginSession } from "../../../fixtures/entity";
import { server } from "../../../server/server";
import { setupIntegration, TEST_LOGIN_SESSION_CACHE } from "../../../fixtures/integration";
import { randomUUID } from "crypto";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessions/login/flows", () => {
  beforeAll(setupIntegration);

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      access_token: "accessToken",
      expires_in: 100,
      scope: ["scope"],
    });

  nock("https://oidc.test.lindorm.io").post("/internal/sessions").times(999).reply(200, {
    redirect_to: "https://apple.com/login",
  });

  nock("https://oidc.test.lindorm.io")
    .get("/internal/sessions/bac83f52-03d6-47e2-b50c-1a759ab2baf7")
    .times(999)
    .reply(200, {
      identity_id: randomUUID(),
      provider: "apple",
    });

  nock("https://vault.test.lindorm.io").post("/internal/vault").times(999).reply(204);

  test("POST /", async () => {
    const loginSession = await TEST_LOGIN_SESSION_CACHE.create(
      createTestLoginSession({
        remember: false,
      }),
    );

    const response = await request(server.callback())
      .post("/sessions/login/oidc")
      .set("Cookie", [
        `lindorm_io_authentication_login_session=${loginSession.id}; path=/; domain=https://authentication.test.lindorm.io; samesite=none`,
      ])
      .send({
        provider: "apple",
        remember: true,
      })
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://apple.com");
    expect(location.pathname).toBe("/login");
  });

  test("GET /callback", async () => {
    const loginSession = await TEST_LOGIN_SESSION_CACHE.create(createTestLoginSession());

    const response = await request(server.callback())
      .get("/sessions/login/oidc/callback?session_id=bac83f52-03d6-47e2-b50c-1a759ab2baf7")
      .set("Cookie", [
        `lindorm_io_authentication_login_session=${loginSession.id}; path=/; domain=https://authentication.test.lindorm.io; samesite=none`,
      ])
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://frontend.url");
    expect(location.pathname).toBe("/login");

    await expect(TEST_LOGIN_SESSION_CACHE.find({ id: loginSession.id })).resolves.toStrictEqual(
      expect.objectContaining({
        amrValues: ["oidc_apple"],
        levelOfAssurance: 3,
      }),
    );
  });
});
