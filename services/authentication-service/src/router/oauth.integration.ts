import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { ClientType, SessionStatus } from "../common";
import { FlowType } from "../enum";
import { TEST_LOGIN_SESSION_CACHE, setupIntegration } from "../fixtures/integration";
import { createURL, getExpires } from "@lindorm-io/core";
import { getTestData } from "../fixtures/data";
import { createTestLoginSession } from "../fixtures/entity";
import { randomUUID } from "crypto";
import { server } from "../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth", () => {
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
    .put("/internal/sessions/authentication/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8/confirm")
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

  nock("https://oauth.test.lindorm.io")
    .put("/internal/sessions/authentication/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8/skip")
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-skip.url/",
    });

  nock("https://oauth.test.lindorm.io")
    .put("/internal/sessions/consent/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8/confirm")
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

  nock("https://oauth.test.lindorm.io")
    .put("/internal/sessions/consent/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8/skip")
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-skip.url/",
    });

  nock("https://oauth.test.lindorm.io")
    .put("/internal/sessions/logout/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8/confirm")
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

  nock("https://oauth.test.lindorm.io")
    .put("/internal/sessions/logout/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8/skip")
    .times(999)
    .reply(200, {
      redirectTo: "https://oauth-redirect-skip.url/",
    });

  test("GET /consent", async () => {
    nock("https://oauth.test.lindorm.io")
      .get("/internal/sessions/consent/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8")
      .reply(200, {
        authorizationSession: {
          displayMode: "page",
          expiresAt: expires.toISOString(),
          expiresIn: expiresIn,
          uiLocales: "en-GB",
        },
        client: {
          scopeDescriptions: [],
          description: "description",
          name: "name",
          requiredScopes: ["openid"],
          type: ClientType.PUBLIC,
          logoUri: "https://logo.uri/",
        },
        consentRequired: true,
        consentStatus: SessionStatus.PENDING,
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
    expect(location.pathname).toBe("/consent");
    expect(location.searchParams.get("display_mode")).toBe("page");
    expect(location.searchParams.get("ui_locales")).toBe("en-GB");

    expect(response.headers["set-cookie"]).toEqual([
      expect.stringContaining("lindorm_io_authentication_consent_session="),
    ]);
    expect(response.headers["set-cookie"]).toEqual([
      expect.stringContaining(
        "; path=/; expires=Fri, 01 Jan 2021 08:30:00 GMT; domain=https://test.lindorm.io; samesite=none",
      ),
    ]);
  });

  test("GET /consent - SKIP", async () => {
    nock("https://oauth.test.lindorm.io")
      .get("/internal/sessions/consent/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8")
      .reply(200, {
        authorizationSession: {
          displayMode: "page",
          expiresAt: expires.toISOString(),
          expiresIn: expiresIn,
          uiLocales: "en-GB",
        },
        client: {
          scopeDescriptions: [],
          description: "description",
          name: "name",
          requiredScopes: ["openid"],
          type: ClientType.PUBLIC,
          logoUri: "https://logo.uri/",
        },
        consentRequired: false,
        consentStatus: SessionStatus.PENDING,
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
    expect(location.origin).toBe("https://oauth-redirect-skip.url");

    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  test("GET /consent - CONFIRM", async () => {
    nock("https://oauth.test.lindorm.io")
      .get("/internal/sessions/consent/28c0d2ce-a3b4-45d8-9845-89d60fe8fed8")
      .reply(200, {
        authorizationSession: {
          displayMode: "page",
          expiresAt: expires.toISOString(),
          expiresIn: expiresIn,
          uiLocales: "en-GB",
        },
        client: {
          scopeDescriptions: [],
          description: "description",
          name: "name",
          requiredScopes: ["openid"],
          type: ClientType.CONFIDENTIAL,
          logoUri: "https://logo.uri/",
        },
        consentRequired: true,
        consentStatus: SessionStatus.PENDING,
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

    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  test("GET /login", async () => {
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
          pkceVerifier: null,
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

  test("GET /login - SKIP", async () => {
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
          pkceVerifier: null,
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

  test("GET /login - CONFIRM", async () => {
    const { expires, expiresIn } = getExpires(new Date("2021-01-01T08:30:00.000Z"));
    const { pkceChallenge, pkceMethod, pkceVerifier } = getTestData();

    const loginSession = await TEST_LOGIN_SESSION_CACHE.create(
      createTestLoginSession({
        amrValues: [FlowType.DEVICE_CHALLENGE],
        expires,
        identityId: randomUUID(),
        levelOfAssurance: 3,
        oauthSessionId: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8",
        pkceChallenge,
        pkceMethod,
      }),
    );

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
          authenticationId: loginSession.id,
          authenticationMethods: [FlowType.DEVICE_CHALLENGE],
          country: "se",
          levelOfAssurance: 3,
          pkceVerifier: pkceVerifier,
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

  test("GET /logout", async () => {
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

  test("GET /logout - CONFIRM", async () => {
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
