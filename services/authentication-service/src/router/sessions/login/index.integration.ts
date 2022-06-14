import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { createTestAuthenticationSession, createTestLoginSession } from "../../../fixtures/entity";
import { createURL } from "@lindorm-io/core";
import { server } from "../../../server/server";
import {
  getTestAuthenticationConfirmationToken,
  setupIntegration,
  TEST_AUTHENTICATION_SESSION_CACHE,
  TEST_LOGIN_SESSION_CACHE,
} from "../../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessions/login", () => {
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

  nock("https://oauth.test.lindorm.io")
    .put((uri) => uri.startsWith("/internal/sessions/authentication/") && uri.endsWith("/reject"))
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-reject.url/",
    });

  test("GET /", async () => {
    const loginSession = await TEST_LOGIN_SESSION_CACHE.create(
      createTestLoginSession({
        authenticationSessionId: "05b9063b-b07a-4ca0-807c-8c6a46ba4bfa",
        codeVerifier: "Jh3c55gN5gk38ghkVCXbp4ksHHPY94MA",
        expires: new Date("2022-01-01T09:00:00.000Z"),
      }),
    );

    const response = await request(server.callback())
      .get("/sessions/login")
      .set("Cookie", [
        `lindorm_io_authentication_login_session=${loginSession.id}; path=/; domain=https://oauth.test.lindorm.io; samesite=none`,
      ])
      .expect(200);

    expect(response.body).toStrictEqual({
      authentication_session_id: "05b9063b-b07a-4ca0-807c-8c6a46ba4bfa",
      code_verifier: "Jh3c55gN5gk38ghkVCXbp4ksHHPY94MA",
      expires: "2022-01-01T09:00:00.000Z",
    });
  });

  test("DELETE /", async () => {
    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession(),
    );

    const loginSession = await TEST_LOGIN_SESSION_CACHE.create(
      createTestLoginSession({
        authenticationSessionId: authenticationSession.id,
      }),
    );

    const response = await request(server.callback())
      .delete("/sessions/login")
      .set("Cookie", [
        `lindorm_io_authentication_login_session=${loginSession.id}; path=/; domain=https://oauth.test.lindorm.io; samesite=none`,
      ])
      .expect(302);

    expect(response.headers.location).toBe("https://oauth-redirect-reject.url/");

    expect(response.headers["set-cookie"]).toEqual([
      "lindorm_io_authentication_login_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly",
    ]);

    await expect(
      TEST_AUTHENTICATION_SESSION_CACHE.find({ id: authenticationSession.id }),
    ).rejects.toThrow(EntityNotFoundError);

    await expect(TEST_LOGIN_SESSION_CACHE.find({ id: loginSession.id })).rejects.toThrow(
      EntityNotFoundError,
    );
  });

  test("GET /confirm", async () => {
    const loginSession = await TEST_LOGIN_SESSION_CACHE.create(createTestLoginSession());

    const authenticationConfirmationToken = getTestAuthenticationConfirmationToken();

    const url = createURL("/sessions/login/confirm", {
      host: "https://test.test",
      query: { authenticationConfirmationToken },
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
