// What lands in which bucket of `ctx.state.access` must agree on BOTH provenances
// — driven end to end, because that divergence is exactly what a mock echoing a
// mock hides: a REAL minted-and-verified token for `verified`, and a REAL
// introspection response through the auth client for `introspected`.
//
// Two buckets and one exclusion:
//   - `custom`  the unregistered claims, `{}` when there are none;
//   - `claims`  the registered ones, INCLUDING RFC 7662 §2.2 `username`;
//   - neither   the RFC 7662 response members that describe the ANSWER rather
//               than the token (`active`, `token_type`).

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
    content?: Record<string, unknown>,
  ): Promise<any> => {
    const signed = await aegis.mint("default", {
      audience: [ACCESS_TEST_ISSUER],
      expires: "1 hour",
      subject: "alice",
      tokenType: "access_token",
      ...content,
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

    // `active`/`token_type` are RFC 7662 §2.2 members describing the ANSWER, and
    // the claim registry knows neither — so the translator sweeps both into its
    // bucket and they would ride out as "custom claims" of the token unless they
    // are taken back out. (`username` IS a registered claim and is asserted
    // separately below.)
    test("should keep the RFC 7662 response members out of the bucket", async () => {
      const ctx = createIntrospectedContext({
        active: true,
        sub: "alice",
        token_type: "Bearer",
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

  // RFC 7662 §2.2 `username` is a REGISTERED aegis claim, so it belongs in
  // `claims` — never in `custom`, and never filtered out as a response member.
  describe("username", () => {
    test("should reach claims.username from a verified token", async () => {
      const ctx = await createVerifiedContext(undefined, {
        username: "alice@lindorm.io",
      });

      await useAccessToken()(ctx, next);

      expect(ctx.state.access.provenance).toBe("verified");
      expect(ctx.state.access.claims.username).toBe("alice@lindorm.io");
      expect(ctx.state.access.custom).toEqual({});
    });

    test("should reach claims.username from an introspection response", async () => {
      const ctx = createIntrospectedContext({
        active: true,
        sub: "alice",
        username: "alice@lindorm.io",
      });

      await useAccessToken()(ctx, next);

      expect(ctx.state.access.provenance).toBe("introspected");
      expect(ctx.state.access.claims.username).toBe("alice@lindorm.io");
      expect(ctx.state.access.custom).toEqual({});
    });

    test("should surface the SAME username on both provenances", async () => {
      const verified = await createVerifiedContext(undefined, {
        username: "alice@lindorm.io",
      });
      await useAccessToken()(verified, next);

      const introspected = createIntrospectedContext({
        active: true,
        sub: "alice",
        username: "alice@lindorm.io",
      });
      await useAccessToken()(introspected, next);

      expect(introspected.state.access.claims.username).toBe(
        verified.state.access.claims.username,
      );
    });

    test("should yield no username when neither credential carries one", async () => {
      const verified = await createVerifiedContext();
      await useAccessToken()(verified, next);

      const introspected = createIntrospectedContext({ active: true, sub: "alice" });
      await useAccessToken()(introspected, next);

      expect(verified.state.access.claims).not.toHaveProperty("username");
      expect(introspected.state.access.claims).not.toHaveProperty("username");
      expect(verified.state.access.custom).not.toHaveProperty("username");
      expect(introspected.state.access.custom).not.toHaveProperty("username");
    });

    // The naming trap. `preferred_username` is a PROFILE claim, and the profile
    // is deliberately absent from an authorization decision — so it reaches
    // NEITHER bucket, while `username` reaches `claims`.
    test("should not confuse username with preferred_username", async () => {
      const ctx = createIntrospectedContext({
        active: true,
        sub: "alice",
        username: "alice@lindorm.io",
        preferred_username: "Alice",
      });

      await useAccessToken()(ctx, next);

      expect(ctx.state.access.claims.username).toBe("alice@lindorm.io");
      expect(ctx.state.access.claims).not.toHaveProperty("preferredUsername");
      expect(ctx.state.access.custom).toEqual({});
    });
  });

  // `active` and `tokenType` are facts about the ANSWER, not the token. `active`
  // would be permanently `true` here (the middleware refuses an inactive token),
  // and neither is an aegis claim — so the resolved credential carries neither,
  // in either bucket, on either provenance.
  describe("RFC 7662 response members", () => {
    test("should keep active and tokenType off the resolved credential", async () => {
      const ctx = createIntrospectedContext({
        active: true,
        sub: "alice",
        token_type: "Bearer",
      });

      await useAccessToken()(ctx, next);

      expect(ctx.state.access.claims).not.toHaveProperty("active");
      expect(ctx.state.access.claims).not.toHaveProperty("tokenType");
      expect(ctx.state.access.claims).not.toHaveProperty("token_type");
      expect(ctx.state.access.custom).not.toHaveProperty("active");
      expect(ctx.state.access.custom).not.toHaveProperty("tokenType");
      expect(ctx.state.access).not.toHaveProperty("active");
      expect(ctx.state.access).not.toHaveProperty("tokenType");
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
