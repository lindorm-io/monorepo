import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { createTestLoginSession } from "../../../fixtures/entity";
import { server } from "../../../server/server";
import { setupIntegration, TEST_LOGIN_SESSION_CACHE } from "../../../fixtures/integration";
import { createURL } from "@lindorm-io/core";
import { EntityNotFoundError } from "@lindorm-io/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessions/login/oidc", () => {
  beforeAll(setupIntegration);

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      accessToken: "accessToken",
      expiresIn: 100,
      scope: ["scope"],
    });

  nock("https://oauth.test.lindorm.io")
    .put((uri) => uri.startsWith("/internal/sessions/authentication/") && uri.endsWith("/confirm"))
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

  nock("https://oidc.test.lindorm.io").post("/internal/sessions").times(999).reply(200, {
    redirectTo: "https://oidc-redirect.url/",
  });

  nock("https://oidc.test.lindorm.io")
    .get((uri) => uri.startsWith("/internal/sessions/"))
    .times(999)
    .reply(200, {
      identityId: "7e64dd56-d9a6-4aa9-a27e-e56c27fe7660",
      levelOfAssurance: 2,
      provider: "google",
    });

  test("POST /", async () => {
    const loginSession = await TEST_LOGIN_SESSION_CACHE.create(
      createTestLoginSession({
        authenticationSessionId: "05b9063b-b07a-4ca0-807c-8c6a46ba4bfa",
        codeVerifier: "Jh3c55gN5gk38ghkVCXbp4ksHHPY94MA",
        expires: new Date("2022-01-01T09:00:00.000Z"),
      }),
    );

    const response = await request(server.callback())
      .post("/sessions/login/oidc")
      .set("Cookie", [
        `lindorm_io_authentication_login_session=${loginSession.id}; path=/; domain=https://oauth.test.lindorm.io; samesite=none`,
      ])
      .send({
        provider: "apple",
        remember: true,
      })
      .expect(302);

    expect(response.headers.location).toBe("https://oidc-redirect.url/");
  });

  test("GET /callback", async () => {
    const loginSession = await TEST_LOGIN_SESSION_CACHE.create(
      createTestLoginSession({
        authenticationSessionId: "05b9063b-b07a-4ca0-807c-8c6a46ba4bfa",
        codeVerifier: "Jh3c55gN5gk38ghkVCXbp4ksHHPY94MA",
        expires: new Date("2022-01-01T09:00:00.000Z"),
      }),
    );

    const url = createURL("/sessions/login/oidc/callback", {
      host: "https://test.test",
      query: { sessionId: "c3bc3377-b671-4dfe-9373-16e3d69ddf27" },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .set("Cookie", [
        `lindorm_io_authentication_login_session=${loginSession.id}; path=/; domain=https://oauth.test.lindorm.io; samesite=none`,
      ])
      .expect(302);

    expect(response.headers.location).toBe("https://oauth-redirect-confirm.url/");

    expect(response.headers["set-cookie"]).toEqual([
      "lindorm_io_authentication_login_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly",
    ]);

    await expect(TEST_LOGIN_SESSION_CACHE.find({ id: loginSession.id })).rejects.toThrow(
      EntityNotFoundError,
    );
  });
});
