import { Aegis } from "@lindorm/aegis";
import { createAuthClient } from "./create-auth-client";
import { getOpenIdConfiguration as _getOpenIdConfiguration } from "./get-open-id-configuration";
import { IntrospectionEndpointFailed } from "../../../errors/IntrospectionEndpointFailed";
import { UserinfoEndpointFailed } from "../../../errors/UserinfoEndpointFailed";

jest.mock("@lindorm/conduit", () => ({
  ...jest.requireActual("@lindorm/conduit"),
  Conduit: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    post: jest.fn(),
  })),
}));

jest.mock("./get-open-id-configuration");

const getOpenIdConfiguration = _getOpenIdConfiguration as jest.Mock;

const { Conduit } = jest.requireMock("@lindorm/conduit");

const createCtx = (overrides: any = {}) => {
  const { state: stateOverrides, ...restOverrides } = overrides;
  return {
    amphora: { config: [] },
    logger: { child: jest.fn().mockReturnThis(), debug: jest.fn(), time: jest.fn() },
    state: {
      app: { environment: "test" },
      metadata: { correlationId: "test-corr" },
      origin: "https://app.example.com",
      tokens: {},
      session: null,
      authorization: null,
      ...stateOverrides,
    },
    ...restOverrides,
  };
};

const createConfig = (overrides: any = {}) => ({
  clientId: "client-id",
  clientSecret: "client-secret",
  issuer: "https://auth.example.com",
  router: null,
  ...overrides,
});

describe("createAuthClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    getOpenIdConfiguration.mockReturnValue({
      authorizationEndpoint: "https://auth.example.com/authorize",
      introspectEndpoint: "https://auth.example.com/introspect",
      logoutEndpoint: "https://auth.example.com/logout",
      tokenEndpoint: "https://auth.example.com/token",
      tokenEndpointAuthMethodsSupported: ["client_secret_basic"],
      userinfoEndpoint: "https://auth.example.com/userinfo",
    });
  });

  describe("introspect", () => {
    test("should return active: true from parsed JWT (fast path)", async () => {
      const ctx = createCtx({
        state: {
          tokens: {
            accessToken: {
              header: { baseFormat: "JWT" },
              payload: {
                subject: "user-123",
                issuer: "https://auth.example.com",
                audience: ["https://api.example.com"],
                expiresAt: new Date("2030-01-01"),
                issuedAt: new Date("2025-01-01"),
                tokenId: "tok-456",
                scope: ["openid", "profile"],
                roles: ["admin"],
                permissions: ["read", "write"],
                tenantId: "tenant-abc",
                levelOfAssurance: 3,
                claims: { custom: "value" },
                confirmation: { thumbprint: "abc" },
                profile: { email: "test@example.com" },
                authMethods: [],
                entitlements: [],
                groups: [],
              },
            },
          },
        },
      });

      const client = createAuthClient(ctx as any, createConfig());
      const result = await client.introspect();

      expect(result.active).toBe(true);

      if (!result.active) throw new Error("unreachable");

      expect(result.subject).toBe("user-123");
      expect(result.issuer).toBe("https://auth.example.com");
      expect(result.tenantId).toBe("tenant-abc");
      expect(result.scope).toEqual(["openid", "profile"]);
      expect(result.roles).toEqual(["admin"]);
      expect(result.levelOfAssurance).toBe(3);
      // ParsedJwtPayload-only fields should NOT leak onto introspection.
      // (PopClaims.confirmation IS part of AegisIntrospectionActive — it
      //  passes through and is asserted separately in other tests.)
      expect((result as any).claims).toBeUndefined();
      expect((result as any).profile).toBeUndefined();
    });

    test("should call introspection endpoint when token is not parsed", async () => {
      const ctx = createCtx({
        state: {
          tokens: {},
          session: { accessToken: "opaque-token-xyz" },
        },
      });

      const mockConduit = Conduit.mock.results[0]?.value ?? { post: jest.fn() };
      // Need to create client first to trigger Conduit construction
      const client = createAuthClient(ctx as any, createConfig());
      const conduitInstance = Conduit.mock.results[0].value;

      conduitInstance.post.mockResolvedValue({
        data: {
          active: true,
          sub: "user-789",
          clientId: "client-id",
          scope: "openid profile",
          tokenType: "Bearer",
          exp: 1900000000,
          iat: 1700000000,
          nbf: 1700000000,
          iss: "https://auth.example.com",
          aud: ["https://api.example.com"],
          jti: "tok-endpoint",
          username: null,
        },
      });

      const result = await client.introspect();

      expect(result.active).toBe(true);

      if (!result.active) throw new Error("unreachable");

      expect(result.subject).toBe("user-789");
      expect(result.scope).toEqual(["openid", "profile"]);
    });

    test("should return active: false from introspection endpoint", async () => {
      const ctx = createCtx({
        state: {
          tokens: {},
          session: { accessToken: "revoked-token" },
        },
      });

      const client = createAuthClient(ctx as any, createConfig());
      const conduitInstance = Conduit.mock.results[0].value;

      conduitInstance.post.mockResolvedValue({
        data: {
          active: false,
          aud: [],
          clientId: null,
          exp: 0,
          iat: 0,
          iss: null,
          jti: null,
          nbf: 0,
          scope: null,
          sub: null,
          tokenType: null,
          username: null,
        },
      });

      const result = await client.introspect();

      expect(result.active).toBe(false);
      // When inactive, no other fields should be accessible (TS enforces this)
      expect(result).toEqual({ active: false });
    });

    test("should cache introspection result per request", async () => {
      const ctx = createCtx({
        state: {
          tokens: {
            accessToken: {
              header: { baseFormat: "JWT" },
              payload: {
                subject: "user-123",
                issuer: "https://auth.example.com",
                audience: [],
                expiresAt: new Date(),
                issuedAt: new Date(),
                tokenId: "tok-1",
                scope: [],
                roles: [],
                permissions: [],
                authMethods: [],
                entitlements: [],
                groups: [],
                claims: {},
                confirmation: undefined,
                profile: undefined,
              },
            },
          },
        },
      });

      const client = createAuthClient(ctx as any, createConfig());

      const first = await client.introspect();
      const second = await client.introspect();

      expect(first).toBe(second); // same reference — cached
    });

    test("should throw IntrospectionEndpointFailed when no access token available", async () => {
      const ctx = createCtx({
        state: {
          tokens: {},
          session: null,
          authorization: null,
        },
      });

      const client = createAuthClient(ctx as any, createConfig());

      await expect(client.introspect()).rejects.toThrow(IntrospectionEndpointFailed);
    });

    test("should throw IntrospectionEndpointFailed when endpoint call fails", async () => {
      const ctx = createCtx({
        state: {
          tokens: {},
          session: { accessToken: "some-token" },
        },
      });

      const client = createAuthClient(ctx as any, createConfig());
      const conduitInstance = Conduit.mock.results[0].value;

      conduitInstance.post.mockRejectedValue(new Error("Network error"));

      await expect(client.introspect()).rejects.toThrow(IntrospectionEndpointFailed);
    });

    test("should use authorization.value when session is absent", async () => {
      const ctx = createCtx({
        state: {
          tokens: {},
          session: null,
          authorization: { value: "bearer-token-abc" },
        },
      });

      const client = createAuthClient(ctx as any, createConfig());
      const conduitInstance = Conduit.mock.results[0].value;

      conduitInstance.post.mockResolvedValue({
        data: {
          active: true,
          sub: "user-bearer",
          clientId: null,
          scope: null,
          tokenType: null,
          exp: 1900000000,
          iat: 1700000000,
          nbf: 1700000000,
          iss: null,
          aud: [],
          jti: null,
          username: null,
        },
      });

      const result = await client.introspect();

      expect(conduitInstance.post).toHaveBeenCalledWith(
        "https://auth.example.com/introspect",
        expect.objectContaining({
          body: { token: "bearer-token-abc" },
        }),
      );

      expect(result.active).toBe(true);
    });
  });

  describe("userinfo", () => {
    test("should return userinfo from parsed id_token (fast path)", async () => {
      const ctx = createCtx({
        state: {
          tokens: {
            idToken: {
              header: { baseFormat: "JWT" },
              payload: {
                sub: "user-123",
                email: "test@example.com",
                name: "Test User",
              },
            },
          },
        },
      });

      const client = createAuthClient(ctx as any, createConfig());
      const result = await client.userinfo();

      expect(result.subject).toBe("user-123");
    });

    test("should call userinfo endpoint when no id_token parsed", async () => {
      const ctx = createCtx({
        state: {
          tokens: {},
          session: { accessToken: "access-token-for-userinfo" },
        },
      });

      const client = createAuthClient(ctx as any, createConfig());
      const conduitInstance = Conduit.mock.results[0].value;

      conduitInstance.get.mockResolvedValue({
        data: {
          sub: "user-endpoint",
          email: "endpoint@example.com",
          name: "Endpoint User",
        },
      });

      const result = await client.userinfo();

      expect(result.subject).toBe("user-endpoint");
    });

    test("should throw UserinfoEndpointFailed when no access token available", async () => {
      const ctx = createCtx({
        state: {
          tokens: {},
          session: null,
          authorization: null,
        },
      });

      const client = createAuthClient(ctx as any, createConfig());

      await expect(client.userinfo()).rejects.toThrow(UserinfoEndpointFailed);
    });

    test("should cache userinfo result per request", async () => {
      const ctx = createCtx({
        state: {
          tokens: {
            idToken: {
              header: { baseFormat: "JWT" },
              payload: { sub: "user-cache", name: "Cache" },
            },
          },
        },
      });

      const client = createAuthClient(ctx as any, createConfig());

      const first = await client.userinfo();
      const second = await client.userinfo();

      expect(first).toBe(second);
    });
  });

  describe("explicit token argument", () => {
    test("introspect: local verify on explicit JWT token (fast path)", async () => {
      const ctx = createCtx({
        state: { tokens: {} },
        aegis: {
          verify: jest.fn().mockResolvedValue({
            header: { baseFormat: "JWT" },
            payload: {
              subject: "explicit-user",
              tenantId: "explicit-tenant",
              roles: ["admin"],
            },
          }),
        },
      });

      const client = createAuthClient(ctx as any, createConfig());

      const result = await client.introspect("eyJhbGciOiJIUzI1NiJ9.explicit");

      expect(ctx.aegis.verify).toHaveBeenCalledWith("eyJhbGciOiJIUzI1NiJ9.explicit");
      expect(result.active).toBe(true);
      if (!result.active) throw new Error("unreachable");
      expect(result.subject).toBe("explicit-user");
      expect(result.tenantId).toBe("explicit-tenant");
    });

    test("introspect: explicit token falls back to endpoint when verify fails", async () => {
      const ctx = createCtx({
        state: { tokens: {} },
        aegis: {
          verify: jest.fn().mockRejectedValue(new Error("opaque")),
        },
      });

      const client = createAuthClient(ctx as any, createConfig());
      const conduitInstance = Conduit.mock.results[0].value;

      conduitInstance.post.mockResolvedValue({
        data: {
          active: true,
          sub: "endpoint-user",
          clientId: "client-id",
          scope: "openid",
          tokenType: "Bearer",
          exp: 1900000000,
          iat: 1700000000,
          nbf: 1700000000,
          iss: "https://auth.example.com",
          aud: ["https://api.example.com"],
          jti: "tok-1",
          username: null,
        },
      });

      const result = await client.introspect("opaque-explicit-token");

      expect(conduitInstance.post).toHaveBeenCalledWith(
        "https://auth.example.com/introspect",
        expect.objectContaining({
          body: { token: "opaque-explicit-token" },
        }),
      );
      expect(result.active).toBe(true);
      if (!result.active) throw new Error("unreachable");
      expect(result.subject).toBe("endpoint-user");
    });

    test("introspect: per-token cache — same token returns same instance", async () => {
      const ctx = createCtx({
        state: { tokens: {} },
        aegis: {
          verify: jest.fn().mockResolvedValue({
            header: { baseFormat: "JWT" },
            payload: { subject: "cached-user" },
          }),
        },
      });

      const client = createAuthClient(ctx as any, createConfig());

      const first = await client.introspect("token-a");
      const second = await client.introspect("token-a");

      expect(first).toBe(second);
      expect(ctx.aegis.verify).toHaveBeenCalledTimes(1);
    });

    test("introspect: per-token cache — different tokens don't collide", async () => {
      const ctx = createCtx({
        state: { tokens: {} },
        aegis: {
          verify: jest
            .fn()
            .mockResolvedValueOnce({
              header: { baseFormat: "JWT" },
              payload: { subject: "user-a" },
            })
            .mockResolvedValueOnce({
              header: { baseFormat: "JWT" },
              payload: { subject: "user-b" },
            }),
        },
      });

      const client = createAuthClient(ctx as any, createConfig());

      const a = await client.introspect("token-a");
      const b = await client.introspect("token-b");

      if (!a.active || !b.active) throw new Error("unreachable");
      expect(a.subject).toBe("user-a");
      expect(b.subject).toBe("user-b");
      expect(a).not.toBe(b);
    });

    test("userinfo: local verify on explicit JWT token", async () => {
      const ctx = createCtx({
        state: { tokens: {} },
        aegis: {
          verify: jest.fn().mockResolvedValue({
            header: { baseFormat: "JWT" },
            payload: {
              subject: "explicit-user",
              email: "explicit@example.com",
            },
          }),
        },
      });

      const client = createAuthClient(ctx as any, createConfig());

      const result = await client.userinfo("eyJhbGciOiJIUzI1NiJ9.explicit");

      expect(ctx.aegis.verify).toHaveBeenCalledWith("eyJhbGciOiJIUzI1NiJ9.explicit");
      expect(result.subject).toBe("explicit-user");
    });

    test("userinfo: explicit token falls back to endpoint when verify fails", async () => {
      const ctx = createCtx({
        state: { tokens: {} },
        aegis: {
          verify: jest.fn().mockRejectedValue(new Error("opaque")),
        },
      });

      const client = createAuthClient(ctx as any, createConfig());
      const conduitInstance = Conduit.mock.results[0].value;

      conduitInstance.get.mockResolvedValue({
        data: { sub: "endpoint-user", name: "Endpoint" },
      });

      const result = await client.userinfo("opaque-explicit-token");

      expect(result.subject).toBe("endpoint-user");
    });
  });
});
