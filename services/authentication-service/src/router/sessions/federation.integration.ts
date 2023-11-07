import { SessionStatus } from "@lindorm-io/common-types";
import { createURL } from "@lindorm-io/url";
import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { createTestAuthenticationSession } from "../../fixtures/entity";
import { setupIntegration, TEST_AUTHENTICATION_SESSION_CACHE } from "../../fixtures/integration";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessions/federation", () => {
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

  nock("https://federation.test.lindorm.io")
    .get("/admin/sessions/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8")
    .times(999)
    .reply(200, {
      callback_id: "16eb29d7-9f02-4883-8973-004870b6901c",
      identity_id: "6a45c383-fd41-4a9e-b76d-c8acb99ea88c",
      level_of_assurance: 3,
      provider: "apple",
    });

  test("should resolve federation callback", async () => {
    const authenticationSession = await TEST_AUTHENTICATION_SESSION_CACHE.create(
      createTestAuthenticationSession({
        id: "16eb29d7-9f02-4883-8973-004870b6901c",
        allowedStrategies: [],
        identityId: "6a45c383-fd41-4a9e-b76d-c8acb99ea88c",
        minimumLevel: 1,
        requiredLevel: 1,
        requiredMethods: [],
      }),
    );

    const url = createURL("/sessions/federation/callback", {
      host: "https://rm.rm",
      query: { session: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://rm.rm", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://frontend.url");
    expect(location.pathname).toBe("/api/federation");
    expect(location.searchParams.get("session")).toBe(authenticationSession.id);

    await expect(
      TEST_AUTHENTICATION_SESSION_CACHE.find({ id: authenticationSession.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        allowedStrategies: [],
        confirmedFederationLevel: 3,
        confirmedFederationProvider: "apple",
        identityId: "6a45c383-fd41-4a9e-b76d-c8acb99ea88c",
        status: SessionStatus.CONFIRMED,
      }),
    );
  });
});
