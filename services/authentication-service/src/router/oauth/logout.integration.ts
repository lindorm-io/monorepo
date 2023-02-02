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

describe("/oauth/logout", () => {
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
    .get((uri) => uri.startsWith("/internal/sessions/logout/") && uri.endsWith("/verify"))
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-verify.url/",
    });

  nock("https://oauth.test.lindorm.io")
    .post((uri) => uri.startsWith("/internal/sessions/logout/") && uri.endsWith("/confirm"))
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

  test("should redirect to front end", async () => {
    nock("https://oauth.test.lindorm.io")
      .get("/internal/sessions/logout/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8")
      .reply(200, {
        logoutStatus: SessionStatus.PENDING,
        client: {
          type: ClientType.PUBLIC,
        },
      });

    const url = createURL("/oauth/logout", {
      host: "https://rm.rm",
      query: { sessionId: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://rm.rm", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://frontend.url");
    expect(location.pathname).toBe("/api/logout");
    expect(location.searchParams.get("session_id")).toBe("28c0d2ce-a3b4-45d8-9845-89d60fe8fed8");
  });

  test("should redirect to verify endpoint on unexpected status", async () => {
    nock("https://oauth.test.lindorm.io")
      .get("/internal/sessions/logout/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8")
      .reply(200, {
        logoutStatus: SessionStatus.CONFIRMED,
        client: {
          type: ClientType.PUBLIC,
        },
      });

    const url = createURL("/oauth/logout", {
      host: "https://rm.rm",
      query: { sessionId: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://rm.rm", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://oauth-redirect-verify.url");
  });

  test("should confirm confidential clients and redirect", async () => {
    nock("https://oauth.test.lindorm.io")
      .get("/internal/sessions/logout/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8")
      .reply(200, {
        logoutStatus: SessionStatus.PENDING,
        client: {
          type: ClientType.CONFIDENTIAL,
        },
      });

    const url = createURL("/oauth/logout", {
      host: "https://rm.rm",
      query: { sessionId: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://rm.rm", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://oauth-redirect-confirm.url");
  });
});
