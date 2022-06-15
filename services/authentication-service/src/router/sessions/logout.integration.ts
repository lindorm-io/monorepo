import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { createTestLogoutSession } from "../../fixtures/entity";
import { server } from "../../server/server";
import { setupIntegration, TEST_LOGOUT_SESSION_CACHE } from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessions/logout", () => {
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
    .put((uri) => uri.startsWith("/internal/sessions/logout/") && uri.endsWith("/confirm"))
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

  nock("https://oauth.test.lindorm.io")
    .put((uri) => uri.startsWith("/internal/sessions/logout/") && uri.endsWith("/reject"))
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-reject.url/",
    });

  test("GET /", async () => {
    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(createTestLogoutSession());

    const response = await request(server.callback())
      .get("/sessions/logout")
      .set("Cookie", [
        `lindorm_io_authentication_logout_session=${logoutSession.id}; path=/; domain=https://oauth.test.lindorm.io; samesite=none`,
      ])
      .expect(200);

    expect(response.body).toStrictEqual({
      client: {
        description: "description",
        logo_uri: "https://client.logo.uri/",
        name: "name",
        type: "public",
      },
    });
  });

  test("PUT /confirm", async () => {
    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(createTestLogoutSession());

    const response = await request(server.callback())
      .put("/sessions/logout/confirm")
      .set("Cookie", [
        `lindorm_io_authentication_logout_session=${logoutSession.id}; path=/; domain=https://oauth.test.lindorm.io; samesite=none`,
      ])
      .expect(302);

    expect(response.headers.location).toBe("https://oauth-redirect-confirm.url/");

    expect(response.headers["set-cookie"]).toEqual([
      "lindorm_io_authentication_logout_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly",
    ]);

    await expect(TEST_LOGOUT_SESSION_CACHE.find({ id: logoutSession.id })).rejects.toThrow(
      EntityNotFoundError,
    );
  });

  test("PUT /reject", async () => {
    const logoutSession = await TEST_LOGOUT_SESSION_CACHE.create(createTestLogoutSession());

    const response = await request(server.callback())
      .put("/sessions/logout/reject")
      .set("Cookie", [
        `lindorm_io_authentication_logout_session=${logoutSession.id}; path=/; domain=https://oauth.test.lindorm.io; samesite=none`,
      ])
      .expect(302);

    expect(response.headers.location).toBe("https://oauth-redirect-reject.url/");

    expect(response.headers["set-cookie"]).toEqual([
      "lindorm_io_authentication_logout_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly",
    ]);

    await expect(TEST_LOGOUT_SESSION_CACHE.find({ id: logoutSession.id })).rejects.toThrow(
      EntityNotFoundError,
    );
  });
});
