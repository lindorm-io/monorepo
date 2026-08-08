// Custom (unregistered) claims must reach `ctx.state.access.custom` on BOTH
// provenances — driven end to end, because that divergence is exactly what a
// mock echoing a mock hides: a REAL minted-and-verified token for `verified`,
// and a REAL introspection response through the auth client for `introspected`.

import type { IAegis } from "@lindorm/aegis";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { OpenIdConfiguration } from "@lindorm/openid";
import axios from "axios";
import nock from "nock";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { Mock } from "vitest";
import { ACCESS_TEST_ISSUER, createTestAegis } from "../../__fixtures__/access/aegis.js";
import { OPAQUE_TOKEN } from "../../__fixtures__/access/tokens.js";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../__fixtures__/app-config.js";
import { OpenIdResourceDriver } from "../../drivers/auth/OpenIdResourceDriver.js";
import { createAuthClient } from "../../internal/utils/auth/create-auth-client.js";
import { useAccessToken } from "./use-access-token.js";

axios.defaults.proxy = false;

const APP_CONFIG = createTestAppConfig({
  auth: createTestAuthConfig({ issuer: ACCESS_TEST_ISSUER }),
});

const openIdConfiguration: Partial<OpenIdConfiguration> = {
  issuer: ACCESS_TEST_ISSUER,
  authorizationEndpoint: `${ACCESS_TEST_ISSUER}/authorize`,
  tokenEndpoint: `${ACCESS_TEST_ISSUER}/token`,
  jwksUri: `${ACCESS_TEST_ISSUER}/jwks`,
  introspectionEndpoint: `${ACCESS_TEST_ISSUER}/introspect`,
};

describe("useAccessToken — custom claims", () => {
  let aegis: IAegis;
  let next: Mock;

  beforeAll(() => {
    aegis = createTestAegis(createMockLogger());
  });

  beforeEach(() => {
    next = vi.fn();
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  /** The http context a bearer credential arrives on. */
  const createContext = (token: string): any => ({
    aegis,
    amphora: {
      idp: {
        config: () => ({ issuer: ACCESS_TEST_ISSUER, openIdConfiguration }),
      },
    },
    logger: createMockLogger(),
    request: {},
    state: {
      access: null,
      app: { config: APP_CONFIG, environment: "test" },
      authorization: { type: "bearer", value: token },
      metadata: { correlationId: "corr-custom-claims" },
      session: null,
      tokens: {},
    },
  });

  // --- verified: a real signature over real custom claims ---

  const createVerifiedContext = async (
    claims?: Record<string, unknown>,
  ): Promise<any> => {
    const signed = await aegis.mint("default", {
      audience: [ACCESS_TEST_ISSUER],
      expires: "1 hour",
      subject: "alice",
      tokenType: "access_token",
      ...(claims ? { claims } : {}),
    });

    return createContext(signed.token);
  };

  // --- introspected: a real RFC 7662 response through the real auth client ---

  const createIntrospectedContext = (body: Record<string, unknown>): any => {
    const ctx = createContext(OPAQUE_TOKEN);

    nock(ACCESS_TEST_ISSUER).post("/introspect").reply(200, body);

    // The REAL client over the REAL driver — the response is parsed by the same
    // code path a deployment runs, not by a stub standing in for it.
    ctx.auth = createAuthClient(ctx, {
      driver: new OpenIdResourceDriver({
        clientId: "resource-server",
        clientSecret: "resource-secret",
      }),
      defaultTokenExpiry: "1d",
      refresh: { maxAge: "1h", mode: "half_life" },
      router: null,
    });

    return ctx;
  };

  describe("verified provenance", () => {
    test("should carry the token's custom claims onto ctx.state.access.custom", async () => {
      const ctx = await createVerifiedContext({
        tenantTier: "gold",
        featureFlags: ["beta-search"],
      });

      await expect(useAccessToken()(ctx, next)).resolves.toBeUndefined();

      expect(ctx.state.access.provenance).toBe("verified");
      expect(ctx.state.access.custom).toEqual({
        tenantTier: "gold",
        featureFlags: ["beta-search"],
      });
      // The registered claims stay where they were — the bucket is additive.
      expect(ctx.state.access.claims.subject).toBe("alice");
      expect(next).toHaveBeenCalledTimes(1);
    });

    // Always an object: the reason `header` was kept off this type is that a
    // half-present field invites `null` reaches, and `custom` must not become one.
    test("should resolve an empty object when the token carries none", async () => {
      const ctx = await createVerifiedContext();

      await useAccessToken()(ctx, next);

      expect(ctx.state.access.custom).toEqual({});
      expect(ctx.state.access.custom).not.toBeUndefined();
    });
  });

  describe("introspected provenance", () => {
    test("should carry the response's custom members onto ctx.state.access.custom", async () => {
      const ctx = createIntrospectedContext({
        active: true,
        sub: "alice",
        tenant_tier: "gold",
        feature_flags: ["beta-search"],
      });

      await expect(useAccessToken()(ctx, next)).resolves.toBeUndefined();

      expect(ctx.state.access.provenance).toBe("introspected");
      expect(ctx.state.access.custom).toEqual({
        tenantTier: "gold",
        featureFlags: ["beta-search"],
      });
      expect(ctx.state.access.claims.subject).toBe("alice");
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("should resolve an empty object when the response carries none", async () => {
      const ctx = createIntrospectedContext({ active: true, sub: "alice" });

      await useAccessToken()(ctx, next);

      expect(ctx.state.access.custom).toEqual({});
      expect(ctx.state.access.custom).not.toBeUndefined();
    });

    // `active`/`token_type`/`username` are RFC 7662 §2.2 members describing the
    // ANSWER, and the claim registry knows none of them — so the translator
    // sweeps all three into its bucket and they would ride out as "custom
    // claims" of the token unless they are taken back out.
    test("should keep the RFC 7662 response members out of the bucket", async () => {
      const ctx = createIntrospectedContext({
        active: true,
        sub: "alice",
        token_type: "Bearer",
        username: "alice@lindorm.io",
      });

      await useAccessToken()(ctx, next);

      expect(ctx.state.access.custom).toEqual({});
    });

    // The flat shape reserves `custom` for the bucket, so a server returning a
    // member of that name is neither lost nor ambiguous: it is unregistered like
    // any other, so it lands INSIDE the bucket.
    test("should nest a member literally named custom inside the bucket", async () => {
      const ctx = createIntrospectedContext({
        active: true,
        sub: "alice",
        custom: "a-literal-value",
      });

      await useAccessToken()(ctx, next);

      expect(ctx.state.access.custom).toEqual({ custom: "a-literal-value" });
    });
  });

  // The whole point of the shape: one read, whatever established the credential.
  test("should surface the SAME custom claim on both provenances", async () => {
    const verified = await createVerifiedContext({ tenantTier: "gold" });
    await useAccessToken()(verified, next);

    const introspected = createIntrospectedContext({
      active: true,
      sub: "alice",
      tenant_tier: "gold",
    });
    await useAccessToken()(introspected, next);

    expect(verified.state.access.provenance).toBe("verified");
    expect(introspected.state.access.provenance).toBe("introspected");
    expect(introspected.state.access.custom).toEqual(verified.state.access.custom);
    expect(introspected.state.access.custom.tenantTier).toBe("gold");
  });
});
