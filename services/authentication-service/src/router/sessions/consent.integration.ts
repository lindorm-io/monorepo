import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { server } from "../../server/server";
import { createTestConsentSession } from "../../fixtures/entity";
import { setupIntegration, TEST_CONSENT_SESSION_CACHE } from "../../fixtures/integration";
import { EntityNotFoundError } from "@lindorm-io/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessions/consent", () => {
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
    .put((uri) => uri.startsWith("/internal/sessions/consent/") && uri.endsWith("/confirm"))
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

  nock("https://oauth.test.lindorm.io")
    .put((uri) => uri.startsWith("/internal/sessions/consent/") && uri.endsWith("/reject"))
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-reject.url/",
    });

  test("GET /", async () => {
    const consentSession = await TEST_CONSENT_SESSION_CACHE.create(createTestConsentSession());

    const response = await request(server.callback())
      .get("/sessions/consent")
      .set("Cookie", [
        `lindorm_io_authentication_consent_session=${consentSession.id}; path=/; domain=https://oauth.test.lindorm.io; samesite=none`,
      ])
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
    });
  });

  test("PUT /confirm", async () => {
    const consentSession = await TEST_CONSENT_SESSION_CACHE.create(
      createTestConsentSession({
        requestedAudiences: [
          "787ea457-83ce-4e25-b3a5-32484e59426a",
          "c47550e3-9fc4-4297-b9ae-cd2fbfca40b4",
        ],
      }),
    );

    const response = await request(server.callback())
      .put("/sessions/consent/confirm")
      .set("Cookie", [
        `lindorm_io_authentication_consent_session=${consentSession.id}; path=/; domain=https://oauth.test.lindorm.io; samesite=none`,
      ])
      .send({
        audiences: ["787ea457-83ce-4e25-b3a5-32484e59426a"],
        scopes: ["openid", "profile", "phone"],
      })
      .expect(302);

    expect(response.headers.location).toBe("https://oauth-redirect-confirm.url/");

    expect(response.headers["set-cookie"]).toEqual([
      "lindorm_io_authentication_consent_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly",
    ]);

    await expect(TEST_CONSENT_SESSION_CACHE.find({ id: consentSession.id })).rejects.toThrow(
      EntityNotFoundError,
    );
  });

  test("PUT /reject", async () => {
    const consentSession = await TEST_CONSENT_SESSION_CACHE.create(createTestConsentSession());

    const response = await request(server.callback())
      .put("/sessions/consent/reject")
      .set("Cookie", [
        `lindorm_io_authentication_consent_session=${consentSession.id}; path=/; domain=https://oauth.test.lindorm.io; samesite=none`,
      ])
      .expect(302);

    expect(response.headers.location).toBe("https://oauth-redirect-reject.url/");

    expect(response.headers["set-cookie"]).toEqual([
      "lindorm_io_authentication_consent_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly",
    ]);

    await expect(TEST_CONSENT_SESSION_CACHE.find({ id: consentSession.id })).rejects.toThrow(
      EntityNotFoundError,
    );
  });
});
