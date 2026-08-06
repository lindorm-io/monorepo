import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { IntrospectionEndpointFailed } from "../../../errors/IntrospectionEndpointFailed.js";
import { UserinfoEndpointFailed } from "../../../errors/UserinfoEndpointFailed.js";
import type { IPylonAuthDriver } from "../../../interfaces/index.js";
import type {
  PylonAuthConfig,
  PylonAuthEndpoints,
  PylonAuthRouterConfig,
} from "../../../types/index.js";
import { createAuthClient } from "./create-auth-client.js";

const ISSUER = "https://auth.lindorm.io";

const ENDPOINTS: PylonAuthEndpoints = {
  issuer: ISSUER,
  jwksUri: `${ISSUER}/jwks`,
  authorizationEndpoint: `${ISSUER}/authorize`,
  tokenEndpoint: `${ISSUER}/token`,
  userinfoEndpoint: `${ISSUER}/userinfo`,
  introspectionEndpoint: `${ISSUER}/introspect`,
  revocationEndpoint: null,
  endSessionEndpoint: `${ISSUER}/end-session`,
};

const ROUTER: PylonAuthRouterConfig = {
  errorRedirect: "/auth/error",
  pathPrefix: "/auth",
  dynamicRedirectDomains: [],
  cookies: { login: "login", logout: "logout" },
  staticRedirect: { login: null, logout: null },
};

/**
 * The driver is stubbed, not the transport: this suite is about what pylon
 * COMPUTES and hands over (state, nonce, PKCE, the callback URI) and what it
 * does with the answer. The wire itself is the drivers' own suites.
 */
const createDriver = (overrides: Partial<IPylonAuthDriver> = {}): IPylonAuthDriver => ({
  clientId: "client-id",
  endpoints: vi.fn().mockResolvedValue(ENDPOINTS),
  authorize: vi.fn(async (_context, options) => {
    const url = new URL(ENDPOINTS.authorizationEndpoint);
    url.searchParams.set("state", options.state);
    url.searchParams.set("scope", "openid profile");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", options.redirectUri);
    if (options.codeChallenge) {
      url.searchParams.set("code_challenge", options.codeChallenge);
    }
    return url;
  }),
  exchange: vi.fn(),
  refresh: vi.fn(),
  introspect: vi.fn().mockResolvedValue({ active: true, subject: "driver-user" }),
  userinfo: vi.fn().mockResolvedValue({ subject: "driver-user" }),
  subject: vi.fn(),
  logout: vi.fn(async (_context, options) => ({
    action: "redirect" as const,
    url: new URL(
      `${ENDPOINTS.endSessionEndpoint}?state=${options.state}&post_logout_redirect_uri=${encodeURIComponent(options.postLogoutRedirectUri)}`,
    ),
  })),
  ...overrides,
});

const createConfig = (driver: IPylonAuthDriver, router = false): PylonAuthConfig => ({
  driver,
  defaultTokenExpiry: "1d",
  refresh: { maxAge: "1h", mode: "half_life" },
  router: router ? ROUTER : null,
});

const createCtx = (overrides: any = {}) => {
  const { state: stateOverrides, ...restOverrides } = overrides;
  return {
    amphora: { idp: { config: () => ({ issuer: ISSUER }) } },
    logger: createMockLogger(),
    state: {
      app: { environment: "test" },
      metadata: { correlationId: "test-corr" },
      origin: "https://app.lindorm.io",
      tokens: {},
      session: null,
      authorization: null,
      ...stateOverrides,
    },
    ...restOverrides,
  };
};

describe("createAuthClient", () => {
  let driver: IPylonAuthDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    driver = createDriver();
  });

  describe("capabilities", () => {
    test("should derive them from the driver rather than from settings", () => {
      const client = createAuthClient(
        createCtx() as any,
        createConfig(createDriver({ introspect: undefined, userinfo: undefined })),
      );

      expect(client.capabilities).toEqual({ introspect: false, userinfo: false });
    });

    test("should report both when the driver implements both", () => {
      const client = createAuthClient(createCtx() as any, createConfig(driver));

      expect(client.capabilities).toEqual({ introspect: true, userinfo: true });
    });
  });

  // The introspection cache keys on (token, issuer, clientId) — RFC 7662 §2.2
  // lets the authorization server answer per requesting client. Both inputs come
  // from the DRIVER, which is the party that authenticates to the endpoint.
  describe("config", () => {
    test("should source the issuer from the driver's endpoints", async () => {
      const client = createAuthClient(createCtx() as any, createConfig(driver));

      await expect(client.config()).resolves.toEqual({
        issuer: ISSUER,
        clientId: "client-id",
      });
    });

    test("should prefer the driver's runtime issuer over any static value", async () => {
      const tenant = createDriver({
        clientId: "resource-server",
        endpoints: vi
          .fn()
          .mockResolvedValue({ ...ENDPOINTS, issuer: "https://tenant.lindorm.io" }),
      });

      const client = createAuthClient(createCtx() as any, createConfig(tenant));

      await expect(client.config()).resolves.toEqual({
        issuer: "https://tenant.lindorm.io",
        clientId: "resource-server",
      });
    });
  });

  describe("introspect", () => {
    test("should return active: true from parsed JWT (fast path)", async () => {
      const ctx = createCtx({
        state: {
          tokens: {
            accessToken: {
              format: "jwt",
              claims: {
                subject: "user-123",
                issuer: ISSUER,
                tenantId: "tenant-abc",
                scope: ["openid", "profile"],
                roles: ["admin"],
                levelOfAssurance: 3,
              },
              custom: { custom: "value" },
              profile: { email: "test@example.com" },
            },
          },
        },
      });

      const result = await createAuthClient(
        ctx as any,
        createConfig(driver),
      ).introspect();

      expect(result.active).toBe(true);
      if (!result.active) throw new Error("unreachable");

      expect(result.subject).toBe("user-123");
      expect(result.tenantId).toBe("tenant-abc");
      // The custom-claim and profile buckets live off the domain `claims`
      // bucket, so they must NOT leak onto introspection.
      expect((result as any).claims).toBeUndefined();
      expect((result as any).profile).toBeUndefined();

      expect(driver.introspect).not.toHaveBeenCalled();
    });

    test("should delegate to the driver when the token is not parsed", async () => {
      const ctx = createCtx({
        state: { tokens: {}, session: { accessToken: "opaque-token-xyz" } },
      });

      const result = await createAuthClient(
        ctx as any,
        createConfig(driver),
      ).introspect();

      expect(driver.introspect).toHaveBeenCalledWith(expect.any(Object), {
        token: "opaque-token-xyz",
      });
      expect(result).toEqual({ active: true, subject: "driver-user" });
    });

    test("should use authorization.value when session is absent", async () => {
      const ctx = createCtx({
        state: { tokens: {}, authorization: { value: "bearer-token-abc" } },
      });

      await createAuthClient(ctx as any, createConfig(driver)).introspect();

      expect(driver.introspect).toHaveBeenCalledWith(expect.any(Object), {
        token: "bearer-token-abc",
      });
    });

    test("should cache the result per request", async () => {
      const ctx = createCtx({
        state: { tokens: {}, session: { accessToken: "opaque" } },
      });
      const client = createAuthClient(ctx as any, createConfig(driver));

      expect(await client.introspect()).toBe(await client.introspect());
      expect(driver.introspect).toHaveBeenCalledTimes(1);
    });

    test("should key the per-token cache by the token", async () => {
      const ctx = createCtx({
        state: { tokens: {} },
        aegis: { verify: vi.fn().mockRejectedValue(new Error("opaque")) },
      });
      const client = createAuthClient(ctx as any, createConfig(driver));

      await client.introspect("token-a");
      await client.introspect("token-a");
      await client.introspect("token-b");

      expect(driver.introspect).toHaveBeenCalledTimes(2);
    });

    test("should verify an explicit JWT locally before reaching the driver", async () => {
      const ctx = createCtx({
        state: { tokens: {} },
        aegis: {
          verify: vi.fn().mockResolvedValue({
            format: "jwt",
            claims: { subject: "explicit-user" },
          }),
        },
      });

      const result = await createAuthClient(ctx as any, createConfig(driver)).introspect(
        "eyJhbGciOiJIUzI1NiJ9.explicit",
      );

      expect(result).toEqual({ active: true, subject: "explicit-user" });
      expect(driver.introspect).not.toHaveBeenCalled();
    });

    test("should throw when no access token can be resolved", async () => {
      const client = createAuthClient(createCtx() as any, createConfig(driver));

      await expect(client.introspect()).rejects.toThrow(IntrospectionEndpointFailed);
    });

    test("should fail by name when the driver cannot introspect", async () => {
      const ctx = createCtx({
        state: { tokens: {}, session: { accessToken: "opaque" } },
      });
      const client = createAuthClient(
        ctx as any,
        createConfig(createDriver({ introspect: undefined })),
      );

      await expect(client.introspect()).rejects.toMatchObject({
        code: "driver_cannot_introspect",
        type: "urn:lindorm:pylon:error:driver_cannot_introspect",
        status: 501,
      });
    });
  });

  describe("userinfo", () => {
    test("should return userinfo from the parsed id_token (fast path)", async () => {
      const ctx = createCtx({
        state: {
          tokens: {
            idToken: { format: "jwt", wire: { payload: { sub: "user-123" } } },
          },
        },
      });

      await expect(
        createAuthClient(ctx as any, createConfig(driver)).userinfo(),
      ).resolves.toMatchObject({ subject: "user-123" });

      expect(driver.userinfo).not.toHaveBeenCalled();
    });

    test("should delegate to the driver when no id_token is parsed", async () => {
      const ctx = createCtx({
        state: { tokens: {}, session: { accessToken: "access-token" } },
      });

      await expect(
        createAuthClient(ctx as any, createConfig(driver)).userinfo(),
      ).resolves.toEqual({ subject: "driver-user" });

      expect(driver.userinfo).toHaveBeenCalledWith(expect.any(Object), {
        accessToken: "access-token",
      });
    });

    test("should throw when no access token can be resolved", async () => {
      const client = createAuthClient(createCtx() as any, createConfig(driver));

      await expect(client.userinfo()).rejects.toThrow(UserinfoEndpointFailed);
    });

    test("should fail by name when the driver cannot fetch userinfo", async () => {
      const ctx = createCtx({
        state: { tokens: {}, session: { accessToken: "access-token" } },
      });
      const client = createAuthClient(
        ctx as any,
        createConfig(createDriver({ userinfo: undefined })),
      );

      await expect(client.userinfo()).rejects.toMatchObject({
        code: "driver_cannot_userinfo",
        type: "urn:lindorm:pylon:error:driver_cannot_userinfo",
        status: 501,
      });
    });
  });

  describe("login", () => {
    test("should throw when no router is configured", async () => {
      const client = createAuthClient(createCtx() as any, createConfig(driver));

      await expect(client.login()).rejects.toMatchObject({
        code: "auth_router_not_configured",
      });
    });

    test("should throw when the driver cannot authorize", async () => {
      const client = createAuthClient(
        createCtx() as any,
        createConfig(createDriver({ authorize: undefined }), true),
      );

      await expect(client.login()).rejects.toMatchObject({
        code: "driver_cannot_authorize",
      });
    });

    test("should generate state, nonce and the PKCE pair itself", async () => {
      const client = createAuthClient(createCtx() as any, createConfig(driver, true));

      const result = await client.login();

      expect(result.state).toEqual(expect.any(String));
      expect(result.nonce).toEqual(expect.any(String));
      expect(result.codeChallengeMethod).toBe("S256");
      expect(result.codeVerifier).toEqual(expect.any(String));
      expect(result.state).not.toBe(result.nonce);
    });

    test("should run without PKCE for a driver that declared none", async () => {
      const noPkce = createDriver({ pkce: null });
      const client = createAuthClient(createCtx() as any, createConfig(noPkce, true));

      const result = await client.login();

      expect(result.codeChallengeMethod).toBeNull();
      expect(result.codeVerifier).toBeNull();
      expect((noPkce.authorize as any).mock.calls[0][1]).toMatchObject({
        codeChallenge: null,
        codeChallengeMethod: null,
      });
    });

    // ⚠ RFC 6749 §4.1.3 requires the exchange's `redirect_uri` to be identical
    // to the authorization request's. Computing it twice is a match nothing
    // enforces, so pylon computes it ONCE and returns it for the cookie.
    test("should return the same callback URI it handed the driver", async () => {
      const client = createAuthClient(createCtx() as any, createConfig(driver, true));

      const result = await client.login();

      expect(result.callbackUri).toBe("https://app.lindorm.io/auth/login/callback");
      expect((driver.authorize as any).mock.calls[0][1].redirectUri).toBe(
        result.callbackUri,
      );
    });

    test("should read the response type and scope back off the driver's url", async () => {
      const client = createAuthClient(createCtx() as any, createConfig(driver, true));

      const result = await client.login();

      expect(result.responseType).toBe("code");
      expect(result.scope).toBe("openid profile");
    });

    test("should pass the caller query through to the driver", async () => {
      const client = createAuthClient(createCtx() as any, createConfig(driver, true));

      await client.login({ loginHint: "alice@lindorm.io" });

      expect((driver.authorize as any).mock.calls[0][1].query).toEqual({
        loginHint: "alice@lindorm.io",
      });
    });

    test("should refuse a url the driver stripped the state from", async () => {
      const stripped = createDriver({
        authorize: vi.fn(async () => new URL(ENDPOINTS.authorizationEndpoint)),
      });
      const client = createAuthClient(createCtx() as any, createConfig(stripped, true));

      await expect(client.login()).rejects.toMatchObject({
        code: "authorize_url_invalid",
      });
    });

    test("should refuse a url the driver stripped the code challenge from", async () => {
      const stripped = createDriver({
        authorize: vi.fn(async (_context, options) => {
          const url = new URL(ENDPOINTS.authorizationEndpoint);
          url.searchParams.set("state", options.state);
          return url;
        }),
      });
      const client = createAuthClient(createCtx() as any, createConfig(stripped, true));

      await expect(client.login()).rejects.toMatchObject({
        code: "authorize_url_invalid",
      });
    });
  });

  describe("logout", () => {
    test("should throw when no router is configured", async () => {
      const client = createAuthClient(createCtx() as any, createConfig(driver));

      await expect(client.logout()).rejects.toMatchObject({
        code: "auth_router_not_configured",
      });
    });

    test("should throw when the driver cannot log out", async () => {
      const client = createAuthClient(
        createCtx() as any,
        createConfig(createDriver({ logout: undefined }), true),
      );

      await expect(client.logout()).rejects.toMatchObject({
        code: "driver_cannot_logout",
      });
    });

    test("should hand the driver the session tokens and pylon's own callback", async () => {
      const ctx = createCtx({
        state: {
          session: {
            accessToken: "at",
            idToken: "it",
            refreshToken: "rt",
          },
        },
      });
      const client = createAuthClient(ctx as any, createConfig(driver, true));

      const result = await client.logout();

      expect(driver.logout).toHaveBeenCalledWith(expect.any(Object), {
        accessToken: "at",
        idTokenHint: "it",
        postLogoutRedirectUri: "https://app.lindorm.io/auth/logout/callback",
        refreshToken: "rt",
        state: result.state,
        query: {},
      });
    });

    test("should return the driver's redirect with pylon's state", async () => {
      const client = createAuthClient(createCtx() as any, createConfig(driver, true));

      const result = await client.logout();

      expect(result.action).toBe("redirect");
      if (result.action !== "redirect") throw new Error("unreachable");
      expect(result.url.origin + result.url.pathname).toBe(`${ISSUER}/end-session`);
      expect(result.url.searchParams.get("state")).toBe(result.state);
    });

    test("should return a local logout when the driver has nothing to redirect to", async () => {
      const local = createDriver({
        logout: vi.fn().mockResolvedValue({ action: "local" }),
      });
      const client = createAuthClient(createCtx() as any, createConfig(local, true));

      await expect(client.logout()).resolves.toEqual({
        action: "local",
        state: expect.any(String),
      });
    });
  });
});
