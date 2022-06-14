import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { AuthenticationMethod } from "../../enum";
import { SessionStatus } from "../../common";
import { createURL, getExpires } from "@lindorm-io/core";
import { server } from "../../server/server";
import {
  getTestAuthenticationConfirmationToken,
  setupIntegration,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth/login", () => {
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
    .put((uri) => uri.startsWith("/internal/sessions/authentication/") && uri.endsWith("/confirm"))
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

  nock("https://oauth.test.lindorm.io")
    .put((uri) => uri.startsWith("/internal/sessions/authentication/") && uri.endsWith("/skip"))
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-skip.url/",
    });

  test("GET /", async () => {
    nock("https://oauth.test.lindorm.io")
      .get("/internal/sessions/authentication/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8")
      .reply(200, {
        authenticationRequired: true,
        authenticationStatus: SessionStatus.PENDING,
        authorizationSession: {
          displayMode: "page",
          expiresAt: expires.toISOString(),
          expiresIn: expiresIn,
          identityId: null,
          loginHint: [],
          uiLocales: ["en-GB"],
        },
        requested: {
          authenticationId: null,
          authenticationMethods: [],
          country: "se",
          levelOfAssurance: 3,
          codeVerifier: null,
        },
      });

    const url = createURL("/oauth/login", {
      host: "https://test.test",
      query: { sessionId: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://frontend.url");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("display_mode")).toBe("page");
    expect(location.searchParams.get("ui_locales")).toBe("en-GB");

    expect(response.headers["set-cookie"]).toEqual([
      expect.stringContaining("lindorm_io_authentication_login_session="),
    ]);
    expect(response.headers["set-cookie"]).toEqual([
      expect.stringContaining(
        "; path=/; expires=Fri, 01 Jan 2021 08:30:00 GMT; domain=https://test.lindorm.io; samesite=none",
      ),
    ]);
  });

  test("GET / - SKIP", async () => {
    nock("https://oauth.test.lindorm.io")
      .get("/internal/sessions/authentication/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8")
      .reply(200, {
        authenticationRequired: false,
        authenticationStatus: SessionStatus.PENDING,
        authorizationSession: {
          displayMode: "page",
          expiresAt: expires.toISOString(),
          expiresIn: expiresIn,
          identityId: null,
          loginHint: [],
          uiLocales: ["en-GB"],
        },
        requested: {
          authenticationId: null,
          authenticationMethods: [],
          country: "se",
          levelOfAssurance: 3,
          codeVerifier: null,
        },
      });

    const url = createURL("/oauth/login", {
      host: "https://test.test",
      query: { sessionId: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" },
    });

    const response = await request(server.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://oauth-redirect-skip.url");

    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  test("GET / - CONFIRM", async () => {
    const authToken = getTestAuthenticationConfirmationToken();

    nock("https://oauth.test.lindorm.io")
      .get(`/internal/sessions/authentication/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8`)
      .reply(200, {
        authenticationRequired: true,
        authenticationStatus: SessionStatus.PENDING,
        authorizationSession: {
          displayMode: "page",
          expiresAt: expires.toISOString(),
          expiresIn: expiresIn,
          identityId: null,
          loginHint: [],
          uiLocales: ["en-GB"],
        },
        requested: {
          authToken: authToken,
          authenticationMethods: [AuthenticationMethod.DEVICE_CHALLENGE],
          country: "se",
          levelOfAssurance: 3,
        },
      });

    const url = createURL("/oauth/login", {
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
