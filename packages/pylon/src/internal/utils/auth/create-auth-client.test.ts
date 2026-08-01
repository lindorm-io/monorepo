import { Aegis } from "@lindorm/aegis";
import { Conduit } from "@lindorm/conduit";
import { ServerError } from "@lindorm/errors";
import { createAuthClient } from "./create-auth-client.js";
import { getOpenIdConfiguration as _getOpenIdConfiguration } from "./get-open-id-configuration.js";
import { IntrospectionEndpointFailed } from "../../../errors/IntrospectionEndpointFailed.js";
import { UserinfoEndpointFailed } from "../../../errors/UserinfoEndpointFailed.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("@lindorm/conduit", async () => ({
  ...(await vi.importActual<typeof import("@lindorm/conduit")>("@lindorm/conduit")),
  Conduit: vi.fn(function () {
    return {
      get: vi.fn(),
      post: vi.fn(),
    };
  }),
}));

vi.mock("./get-open-id-configuration.js");

const getOpenIdConfiguration = _getOpenIdConfiguration as Mock;

const MockedConduit = Conduit as unknown as Mock;

const createCtx = (overrides: any = {}) => {
  const { state: stateOverrides, ...restOverrides } = overrides;
  return {
    amphora: { config: [] },
    logger: { child: vi.fn().mockReturnThis(), debug: vi.fn(), time: vi.fn() },
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
    vi.clearAllMocks();

    getOpenIdConfiguration.mockReturnValue({
      authorizationEndpoint: "https://auth.example.com/authorize",
      introspectionEndpoint: "https://auth.example.com/introspect",
      endSessionEndpoint: "https://auth.example.com/end-session",
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
              format: "jwt",
              claims: {
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
                confirmation: { thumbprint: "abc" },
                authMethods: [],
                entitlements: [],
                groups: [],
              },
              custom: { custom: "value" },
              profile: { email: "test@example.com" },
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
      // The custom-claim and profile buckets live off the domain `claims`
      // bucket, so they must NOT leak onto introspection. (PopClaims.confirmation
      // IS a registered claim and passes through — asserted elsewhere.)
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

      const mockConduit = MockedConduit.mock.results[0]?.value ?? { post: vi.fn() };
      // Need to create client first to trigger Conduit construction
      const client = createAuthClient(ctx as any, createConfig());
      const conduitInstance = MockedConduit.mock.results[0].value;

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
      const conduitInstance = MockedConduit.mock.results[0].value;

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
              format: "jwt",
              claims: {
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
                confirmation: undefined,
              },
              custom: {},
              profile: undefined,
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
      const conduitInstance = MockedConduit.mock.results[0].value;

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
      const conduitInstance = MockedConduit.mock.results[0].value;

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
              format: "jwt",
              wire: {
                payload: {
                  sub: "user-123",
                  email: "test@example.com",
                  name: "Test User",
                },
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
      const conduitInstance = MockedConduit.mock.results[0].value;

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
              format: "jwt",
              wire: { payload: { sub: "user-cache", name: "Cache" } },
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
          verify: vi.fn().mockResolvedValue({
            format: "jwt",
            claims: {
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
          verify: vi.fn().mockRejectedValue(new Error("opaque")),
        },
      });

      const client = createAuthClient(ctx as any, createConfig());
      const conduitInstance = MockedConduit.mock.results[0].value;

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
          verify: vi.fn().mockResolvedValue({
            format: "jwt",
            claims: { subject: "cached-user" },
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
          verify: vi
            .fn()
            .mockResolvedValueOnce({
              format: "jwt",
              claims: { subject: "user-a" },
            })
            .mockResolvedValueOnce({
              format: "jwt",
              claims: { subject: "user-b" },
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
          verify: vi.fn().mockResolvedValue({
            format: "jwt",
            wire: {
              payload: {
                sub: "explicit-user",
                email: "explicit@example.com",
              },
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
          verify: vi.fn().mockRejectedValue(new Error("opaque")),
        },
      });

      const client = createAuthClient(ctx as any, createConfig());
      const conduitInstance = MockedConduit.mock.results[0].value;

      conduitInstance.get.mockResolvedValue({
        data: { sub: "endpoint-user", name: "Endpoint" },
      });

      const result = await client.userinfo("opaque-explicit-token");

      expect(result.subject).toBe("endpoint-user");
    });
  });

  // The discovery document is read by its RFC wire names — camelised, that is
  // `introspection_endpoint` -> `introspectionEndpoint` and `end_session_endpoint`
  // -> `endSessionEndpoint`. Reading a non-standard name silently yields
  // `undefined` and the RP requests the wrong URL, so both are asserted.
  describe("discovery endpoint names", () => {
    test("should post introspection to the introspectionEndpoint", async () => {
      const ctx = createCtx({
        state: {
          tokens: {},
          session: { accessToken: "opaque-token-xyz" },
        },
      });

      const client = createAuthClient(ctx as any, createConfig());
      const conduitInstance = MockedConduit.mock.results[0].value;

      conduitInstance.post.mockResolvedValue({
        data: { active: false },
      });

      await client.introspect();

      expect(conduitInstance.post).toHaveBeenCalledWith(
        "https://auth.example.com/introspect",
        expect.any(Object),
      );
    });

    test("should name the introspectionEndpoint in the failure error data", async () => {
      const ctx = createCtx({
        state: {
          tokens: {},
          session: { accessToken: "opaque-token-xyz" },
        },
      });

      const client = createAuthClient(ctx as any, createConfig());
      const conduitInstance = MockedConduit.mock.results[0].value;

      conduitInstance.post.mockRejectedValue(new Error("gateway down"));

      await expect(client.introspect()).rejects.toThrow(IntrospectionEndpointFailed);

      await expect(client.introspect()).rejects.toMatchObject({
        data: { introspectionEndpoint: "https://auth.example.com/introspect" },
      });
    });

    test("should redirect logout to the endSessionEndpoint", async () => {
      const ctx = createCtx();

      const client = createAuthClient(
        ctx as any,
        createConfig({ router: { pathPrefix: "/auth" } }),
      );

      const { redirect } = client.logout();

      expect(redirect.origin + redirect.pathname).toBe(
        "https://auth.example.com/end-session",
      );
    });

    test("should redirect login to the authorizationEndpoint", async () => {
      const ctx = createCtx();

      const client = createAuthClient(
        ctx as any,
        createConfig({
          router: {
            pathPrefix: "/auth",
            resourceKey: "resource",
            authorize: {
              codeChallengeMethod: "S256",
              responseType: "code",
              scope: ["openid"],
            },
          },
        }),
      );

      const { redirect } = client.login();

      expect(redirect.origin + redirect.pathname).toBe(
        "https://auth.example.com/authorize",
      );
    });

    test("should post the token request to the tokenEndpoint", async () => {
      const ctx = createCtx();

      const client = createAuthClient(ctx as any, createConfig());
      const conduitInstance = MockedConduit.mock.results[0].value;

      conduitInstance.post.mockResolvedValue({ data: { accessToken: "at" } });

      await client.token({ grantType: "authorization_code", code: "code" } as any);

      expect(conduitInstance.post).toHaveBeenCalledWith(
        "https://auth.example.com/token",
        expect.any(Object),
      );
    });
  });

  // `userinfo_endpoint` is RECOMMENDED, `introspection_endpoint` and
  // `end_session_endpoint` are OPTIONAL — a real IdP omits them (Auth0 publishes no
  // introspection endpoint). The operation must fail by name, not request `undefined`.
  describe("optional discovery endpoints", () => {
    const omitFromConfiguration = (field: string) => {
      const openid = {
        authorizationEndpoint: "https://auth.example.com/authorize",
        introspectionEndpoint: "https://auth.example.com/introspect",
        endSessionEndpoint: "https://auth.example.com/end-session",
        tokenEndpoint: "https://auth.example.com/token",
        tokenEndpointAuthMethodsSupported: ["client_secret_basic"],
        userinfoEndpoint: "https://auth.example.com/userinfo",
      } as any;

      delete openid[field];

      getOpenIdConfiguration.mockReturnValue(openid);
    };

    test("should throw when the IdP publishes no userinfo endpoint", async () => {
      omitFromConfiguration("userinfoEndpoint");

      const ctx = createCtx({
        state: { tokens: {}, session: { accessToken: "opaque-token-xyz" } },
      });

      const client = createAuthClient(ctx as any, createConfig());

      await expect(client.userinfo()).rejects.toMatchObject({
        code: "idp_userinfo_endpoint_not_supported",
        type: "urn:lindorm:pylon:error:idp_userinfo_endpoint_not_supported",
        status: 501,
        data: { issuer: "https://auth.example.com" },
      });
    });

    test("should call the userinfo endpoint when the IdP publishes one", async () => {
      const ctx = createCtx({
        state: { tokens: {}, session: { accessToken: "opaque-token-xyz" } },
      });

      const client = createAuthClient(ctx as any, createConfig());
      const conduitInstance = MockedConduit.mock.results[0].value;

      conduitInstance.get.mockResolvedValue({ data: { sub: "user-endpoint" } });

      await expect(client.userinfo()).resolves.toMatchObject({
        subject: "user-endpoint",
      });

      expect(conduitInstance.get).toHaveBeenCalledWith(
        "https://auth.example.com/userinfo",
        expect.any(Object),
      );
    });

    test("should throw when the IdP publishes no introspection endpoint", async () => {
      omitFromConfiguration("introspectionEndpoint");

      const ctx = createCtx({
        state: { tokens: {}, session: { accessToken: "opaque-token-xyz" } },
      });

      const client = createAuthClient(ctx as any, createConfig());

      await expect(client.introspect()).rejects.toMatchObject({
        code: "idp_introspection_endpoint_not_supported",
        type: "urn:lindorm:pylon:error:idp_introspection_endpoint_not_supported",
        status: 501,
        data: { issuer: "https://auth.example.com" },
      });
    });

    test("should call the introspection endpoint when the IdP publishes one", async () => {
      const ctx = createCtx({
        state: { tokens: {}, session: { accessToken: "opaque-token-xyz" } },
      });

      const client = createAuthClient(ctx as any, createConfig());
      const conduitInstance = MockedConduit.mock.results[0].value;

      conduitInstance.post.mockResolvedValue({ data: { active: false } });

      await expect(client.introspect()).resolves.toEqual({ active: false });

      expect(conduitInstance.post).toHaveBeenCalledWith(
        "https://auth.example.com/introspect",
        expect.any(Object),
      );
    });

    test("should throw when the IdP publishes no end session endpoint", async () => {
      omitFromConfiguration("endSessionEndpoint");

      const ctx = createCtx();

      const client = createAuthClient(
        ctx as any,
        createConfig({ router: { pathPrefix: "/auth" } }),
      );

      let error: any = null;
      try {
        client.logout();
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ServerError);
      expect(error.code).toBe("idp_end_session_endpoint_not_supported");
      expect(error.type).toBe(
        "urn:lindorm:pylon:error:idp_end_session_endpoint_not_supported",
      );
      expect(error.status).toBe(501);
    });

    test("should redirect to the end session endpoint when the IdP publishes one", async () => {
      const ctx = createCtx();

      const client = createAuthClient(
        ctx as any,
        createConfig({ router: { pathPrefix: "/auth" } }),
      );

      const { redirect } = client.logout();

      expect(redirect.origin + redirect.pathname).toBe(
        "https://auth.example.com/end-session",
      );
    });

    test("should not throw for a missing userinfo endpoint on the id_token fast path", async () => {
      omitFromConfiguration("userinfoEndpoint");

      const ctx = createCtx({
        state: {
          tokens: {
            idToken: { format: "jwt", wire: { payload: { sub: "user-fast" } } },
          },
        },
      });

      const client = createAuthClient(ctx as any, createConfig());

      await expect(client.userinfo()).resolves.toMatchObject({
        subject: "user-fast",
      });
    });
  });

  // OIDC Discovery §3 / RFC 8414 §2 — `token_endpoint_auth_methods_supported` is
  // OPTIONAL, and when absent the spec default is `client_secret_basic`.
  describe("token endpoint auth methods", () => {
    const withAuthMethods = (methods?: Array<string>) => {
      getOpenIdConfiguration.mockReturnValue({
        authorizationEndpoint: "https://auth.example.com/authorize",
        introspectionEndpoint: "https://auth.example.com/introspect",
        endSessionEndpoint: "https://auth.example.com/end-session",
        tokenEndpoint: "https://auth.example.com/token",
        userinfoEndpoint: "https://auth.example.com/userinfo",
        ...(methods ? { tokenEndpointAuthMethodsSupported: methods } : {}),
      });
    };

    const tokenRequest = async () => {
      const ctx = createCtx();
      const client = createAuthClient(ctx as any, createConfig());
      const conduitInstance = MockedConduit.mock.results[0].value;

      conduitInstance.post.mockResolvedValue({ data: { accessToken: "at" } });

      await client.token({ grantType: "authorization_code", code: "code" } as any);

      return conduitInstance.post.mock.calls[0][1];
    };

    test("should default to client_secret_basic when the IdP advertises none", async () => {
      withAuthMethods();

      const options = await tokenRequest();

      // Basic auth is applied via middleware, and the credentials stay out of the body.
      expect(options.middleware).toHaveLength(1);
      expect(options.body.clientId).toBeUndefined();
      expect(options.body.clientSecret).toBeUndefined();

      const middlewareCtx: any = { req: { headers: {} } };
      await options.middleware[0](middlewareCtx, async () => {});

      expect(middlewareCtx.req.headers.Authorization).toBe(
        `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
      );
    });

    test("should use client_secret_post when the IdP advertises it", async () => {
      withAuthMethods(["client_secret_post"]);

      const options = await tokenRequest();

      expect(options.middleware).toEqual([]);
      expect(options.body).toMatchObject({
        clientId: "client-id",
        clientSecret: "client-secret",
      });
    });

    test("should use client_secret_basic when the IdP advertises it", async () => {
      withAuthMethods(["client_secret_basic"]);

      const options = await tokenRequest();

      expect(options.middleware).toHaveLength(1);
      expect(options.body.clientId).toBeUndefined();
    });
  });
});
