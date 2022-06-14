import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { ClientType } from "../../common";
import { createURL, getExpires } from "@lindorm-io/core";
import { server } from "../../server/server";
import { setupIntegration } from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth/logout", () => {
  const { expires, expiresIn } = getExpires(new Date("2021-01-01T08:30:00.000Z"));

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
    .put((uri) => uri.startsWith("/internal/sessions/skip/") && uri.endsWith("/confirm"))
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-skip.url/",
    });

  test("GET /", async () => {
    nock("https://oauth.test.lindorm.io")
      .get("/internal/sessions/logout/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8")
      .reply(200, {
        client: {
          name: "name",
          logoUri: "https://logo.uri/",
          description: "description",
          type: ClientType.PUBLIC,
        },
        logoutSession: {
          expiresAt: expires.toISOString(),
          expiresIn: expiresIn,
        },
      });

    const url = createURL("/oauth/logout", {
      host: "https://test.test",
      query: { sessionId: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://frontend.url");
    expect(location.pathname).toBe("/logout");
    // expect(location.searchParams.get("display_mode")).toBe("page");
    // expect(location.searchParams.get("ui_locales")).toBe("en-GB");

    expect(response.headers["set-cookie"]).toEqual([
      expect.stringContaining("lindorm_io_authentication_logout_session="),
    ]);
    expect(response.headers["set-cookie"]).toEqual([
      expect.stringContaining(
        "; path=/; expires=Fri, 01 Jan 2021 08:30:00 GMT; domain=https://test.lindorm.io; samesite=none",
      ),
    ]);
  });

  test("GET / - CONFIRM", async () => {
    nock("https://oauth.test.lindorm.io")
      .get("/internal/sessions/logout/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8")
      .reply(200, {
        client: {
          name: "name",
          logoUri: "https://logo.uri/",
          description: "description",
          type: ClientType.CONFIDENTIAL,
        },
        logoutSession: {
          expiresAt: expires.toISOString(),
          expiresIn: expiresIn,
        },
      });

    const url = createURL("/oauth/logout", {
      host: "https://test.test",
      query: { sessionId: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://oauth-redirect-confirm.url");

    expect(response.headers["set-cookie"]).toBeUndefined();
  });
});
