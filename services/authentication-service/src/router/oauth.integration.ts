import MockDate from "mockdate";
import request from "supertest";
import { ClientType, SessionStatus } from "../common";
import { FlowType } from "../enum";
import { createURL, getExpires } from "@lindorm-io/core";
import { getTestData } from "../test/data";
import { getTestLoginSession } from "../test/entity";
import { koa } from "../server/koa";
import { randomUUID } from "crypto";
import {
  getAxiosResponse,
  setAxiosResponse,
  setupIntegration,
  TEST_LOGIN_SESSION_CACHE,
} from "../test/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("@lindorm-io/axios", () => ({
  ...(jest.requireActual("@lindorm-io/axios") as Record<string, any>),
  Axios: class Axios {
    private readonly name: string;
    public constructor(opts: any) {
      this.name = opts.name;
    }
    public async get(path: string, args: any): Promise<any> {
      return getAxiosResponse("GET", this.name, path, args);
    }
    public async post(path: string, args: any): Promise<any> {
      return getAxiosResponse("POST", this.name, path, args);
    }
    public async put(path: string, args: any): Promise<any> {
      return getAxiosResponse("PUT", this.name, path, args);
    }
    public async patch(path: string, args: any): Promise<any> {
      return getAxiosResponse("PATCH", this.name, path, args);
    }
    public async delete(path: string, args: any): Promise<any> {
      return getAxiosResponse("DELETE", this.name, path, args);
    }
    public async request(method: string, path: string, args: any): Promise<any> {
      return getAxiosResponse(method.toUpperCase(), this.name, path, args);
    }
  },
}));

describe("/oauth", () => {
  beforeAll(setupIntegration);

  test("GET /consent", async () => {
    const { expires, expiresIn } = getExpires(new Date("2021-01-01T08:30:00.000Z"));

    setAxiosResponse("GET", "oauthClient", "/internal/sessions/consent/:id", {
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
      baseUrl: "https://test.test",
      query: { sessionId: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" },
    });

    const response = await request(koa.callback())
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
        "; path=/; expires=Fri, 01 Jan 2021 08:30:00 GMT; domain=https://lindorm.io; samesite=none",
      ),
    ]);
  });

  test("GET /consent - SKIP", async () => {
    const { expires, expiresIn } = getExpires(new Date("2021-01-01T08:30:00.000Z"));

    setAxiosResponse("GET", "oauthClient", "/internal/sessions/consent/:id", {
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

    setAxiosResponse("PUT", "oauthClient", "/internal/sessions/consent/:id/skip", {
      redirectTo: "https://oauth-redirect-skip.url/",
    });

    const url = createURL("/oauth/consent", {
      baseUrl: "https://test.test",
      query: { sessionId: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" },
    });

    const response = await request(koa.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://oauth-redirect-skip.url");

    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  test("GET /consent - CONFIRM", async () => {
    const { expires, expiresIn } = getExpires(new Date("2021-01-01T08:30:00.000Z"));

    setAxiosResponse("GET", "oauthClient", "/internal/sessions/consent/:id", {
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

    setAxiosResponse("PUT", "oauthClient", "/internal/sessions/consent/:id/confirm", {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

    const url = createURL("/oauth/consent", {
      baseUrl: "https://test.test",
      query: { sessionId: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" },
    });

    const response = await request(koa.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://oauth-redirect-confirm.url");

    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  test("GET /login", async () => {
    const { expires, expiresIn } = getExpires(new Date("2021-01-01T08:30:00.000Z"));

    setAxiosResponse("GET", "oauthClient", "/internal/sessions/authentication/:id", {
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
      baseUrl: "https://test.test",
      query: { sessionId: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" },
    });

    const response = await request(koa.callback())
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
        "; path=/; expires=Fri, 01 Jan 2021 08:30:00 GMT; domain=https://lindorm.io; samesite=none",
      ),
    ]);
  });

  test("GET /login - SKIP", async () => {
    const { expires, expiresIn } = getExpires(new Date("2021-01-01T08:30:00.000Z"));

    setAxiosResponse("GET", "oauthClient", "/internal/sessions/authentication/:id", {
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

    setAxiosResponse("PUT", "oauthClient", "/internal/sessions/authentication/:id/skip", {
      redirectTo: "https://oauth-redirect-skip.url/",
    });

    const url = createURL("/oauth/login", {
      baseUrl: "https://test.test",
      query: { sessionId: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" },
    });

    const response = await request(koa.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://oauth-redirect-skip.url");

    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  test("GET /login - CONFIRM", async () => {
    const { expires, expiresIn } = getExpires(new Date("2021-01-01T08:30:00.000Z"));
    const { pkceChallenge, pkceMethod, pkceVerifier } = getTestData();
    const oauthSessionId = randomUUID();

    const loginSession = await TEST_LOGIN_SESSION_CACHE.create(
      getTestLoginSession({
        amrValues: [FlowType.DEVICE_CHALLENGE],
        expires,
        identityId: randomUUID(),
        levelOfAssurance: 3,
        oauthSessionId,
        pkceChallenge,
        pkceMethod,
      }),
    );

    setAxiosResponse("GET", "oauthClient", "/internal/sessions/authentication/:id", {
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

    setAxiosResponse("PUT", "oauthClient", "/internal/sessions/authentication/:id/confirm", {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

    const url = createURL("/oauth/login", {
      baseUrl: "https://test.test",
      query: { sessionId: oauthSessionId },
    });

    const response = await request(koa.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://oauth-redirect-confirm.url");

    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  test("GET /logout", async () => {
    const { expires, expiresIn } = getExpires(new Date("2021-01-01T08:30:00.000Z"));

    setAxiosResponse("GET", "oauthClient", "/internal/sessions/logout/:id", {
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
      baseUrl: "https://test.test",
      query: { sessionId: "28c0d2ce-a3b4-45d8-9845-89d60fe8fed8" },
    });

    const response = await request(koa.callback())
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
        "; path=/; expires=Fri, 01 Jan 2021 08:30:00 GMT; domain=https://lindorm.io; samesite=none",
      ),
    ]);
  });

  test("GET /logout - CONFIRM", async () => {
    const { expires, expiresIn } = getExpires(new Date("2021-01-01T08:30:00.000Z"));
    const oauthSessionId = randomUUID();

    setAxiosResponse("GET", "oauthClient", "/internal/sessions/logout/:id", {
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

    setAxiosResponse("PUT", "oauthClient", "/internal/sessions/logout/:id/confirm", {
      redirectTo: "https://oauth-redirect-confirm.url/",
    });

    const url = createURL("/oauth/logout", {
      baseUrl: "https://test.test",
      query: { sessionId: oauthSessionId },
    });

    const response = await request(koa.callback())
      .get(url.toString().replace("https://test.test", ""))
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://oauth-redirect-confirm.url");

    expect(response.headers["set-cookie"]).toBeUndefined();
  });
});
