import MockDate from "mockdate";
import request from "supertest";
import { createTestFederationSession } from "../../fixtures/entity";
import {
  getTestClientCredentials,
  setupIntegration,
  TEST_FEDERATION_SESSION_CACHE,
} from "../../fixtures/integration";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/admin/sessions", () => {
  beforeAll(setupIntegration);

  test("POST /", async () => {
    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .post("/admin/sessions")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        callback_id: "3ada5d06-23d0-41ac-9344-b91a18b22f19",
        callback_uri: "https://test.lindorm.io/callback",
        expires: "2021-01-02T08:00:00.000+05:00",
        identity_id: "f60ad331-710e-4833-b77a-d7ce3c2e4fdb",
        login_hint: "test@lindorm.io",
        provider: "microsoft",
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      redirect_to: expect.any(String),
    });

    const url = new URL(response.body.redirect_to);

    expect(url.host).toBe("microsoft.com");
    expect(url.pathname).toBe("/authorize");
    expect(url.searchParams.get("client_id")).toBe("microsoft_client_id");
    expect(url.searchParams.get("login_hint")).toBe("test@lindorm.io");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://federation.test.lindorm.io/callback",
    );
    expect(url.searchParams.get("response_mode")).toBe("query");
    expect(url.searchParams.get("response_type")).toBe("token");
    expect(url.searchParams.get("scope")).toBe("openid profile");
  });

  test("GET /:id", async () => {
    const federationSession = await TEST_FEDERATION_SESSION_CACHE.create(
      createTestFederationSession({
        callbackId: "3ada5d06-23d0-41ac-9344-b91a18b22f19",
        identityId: "f60ad331-710e-4833-b77a-d7ce3c2e4fdb",
        provider: "google",
        verified: true,
      }),
    );

    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .get(`/admin/sessions/${federationSession.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      callback_id: "3ada5d06-23d0-41ac-9344-b91a18b22f19",
      identity_id: "f60ad331-710e-4833-b77a-d7ce3c2e4fdb",
      level_of_assurance: 2,
      provider: "google",
    });
  });
});
