import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { ClientType, SessionStatus } from "../../common";
import { createURL } from "@lindorm-io/url";
import { server } from "../../server/server";
import { setupIntegration } from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth/consent", () => {
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
    .get((uri) => uri.startsWith("/internal/sessions/consent/") && uri.endsWith("/verify"))
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-verify.url/",
    });

  nock("https://oauth.test.lindorm.io")
    .post((uri) => uri.startsWith("/internal/sessions/consent/") && uri.endsWith("/confirm"))
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

  test("should redirect to front end", async () => {
    nock("https://oauth.test.lindorm.io")
      .get("/internal/sessions/consent/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8")
      .reply(200, {
        consentStatus: SessionStatus.PENDING,
        client: {
          type: ClientType.PUBLIC,
        },
        requested: {
          audiences: ["fe016418-21e7-43d2-9855-a72fa382ed49"],
          scopes: ["openid", "profile"],
        },
      });

    const url = createURL("/oauth/consent", {
      host: "https://test.test",
      query: { sessionId: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);

    expect(location.origin).toBe("https://frontend.url");
    expect(location.pathname).toBe("/api/consent");
    expect(location.searchParams.get("session_id")).toBe("28c0d2ce-a3b4-45d8-9845-89d60fe8fed8");
  });

  test("should redirect to verify endpoint on unexpected status", async () => {
    nock("https://oauth.test.lindorm.io")
      .get("/internal/sessions/consent/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8")
      .reply(200, {
        consentStatus: SessionStatus.CONFIRMED,
        client: {
          type: ClientType.PUBLIC,
        },
        requested: {
          audiences: ["fe016418-21e7-43d2-9855-a72fa382ed49"],
          scopes: ["openid", "profile"],
        },
      });

    const url = createURL("/oauth/consent", {
      host: "https://rm.rm",
      query: { sessionId: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://rm.rm", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://oauth-redirect-verify.url");

    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  test("should confirm confidential clients and redirect", async () => {
    nock("https://oauth.test.lindorm.io")
      .get("/internal/sessions/consent/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8")
      .reply(200, {
        consentStatus: SessionStatus.PENDING,
        client: {
          type: ClientType.CONFIDENTIAL,
        },
        requested: {
          audiences: ["fe016418-21e7-43d2-9855-a72fa382ed49"],
          scopes: ["openid", "profile"],
        },
      });

    const url = createURL("/oauth/consent", {
      host: "https://test.test",
      query: { sessionId: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://oauth-redirect-confirm.url");
  });
});
