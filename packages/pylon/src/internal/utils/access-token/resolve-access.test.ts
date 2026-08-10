import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { ServerError } from "@lindorm/errors";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { OPAQUE_TOKEN, joseShapedToken } from "../../../__fixtures__/access/tokens.js";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../../__fixtures__/app-config.js";
import { resolveAccess } from "./resolve-access.js";

const ISSUER = "https://test.lindorm.io/";
const TOKEN = joseShapedToken();

/**
 * The two arms, in ONE place — which is the whole point of the file. Everything
 * that follows resolution (the claim assert, the DPoP binding) reads the shape
 * produced here, so a divergence between the arms shows up as a divergence in
 * these fields.
 */
describe("resolveAccess", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      aegis: createMockAegis(),
      auth: { introspect: vi.fn() },
      state: { app: { config: createTestAppConfig({ auth: createTestAuthConfig() }) } },
    };
  });

  describe("structured arm", () => {
    beforeEach(() => {
      (ctx.aegis.verify as Mock).mockResolvedValue({
        claims: { subject: "alice", issuer: ISSUER },
        custom: { tier: "gold" },
        format: "jwt",
        token: TOKEN,
      });
    });

    test("verifies locally and never introspects", async () => {
      const result = await resolveAccess(ctx, TOKEN, {
        cache: undefined,
        verifyOptions: {},
      });

      expect(ctx.auth.introspect).not.toHaveBeenCalled();
      expect(result.access.provenance).toBe("verified");
      expect(result.access.claims).toEqual({ subject: "alice", issuer: ISSUER });
      expect(result.access.custom).toEqual({ tier: "gold" });
      expect(result.access.token).toBe(TOKEN);
      expect(result.issuer).toBe(ISSUER);
      expect(result.verified).toBeDefined();
    });

    // ⚠ `assert` is undefined and `trustBoundThumbprint` is on: the matchers are
    // a later, shared pass, and pylon owns the DPoP binding check for both arms.
    test("passes the verify KNOBS only, and no assert", async () => {
      await resolveAccess(ctx, TOKEN, {
        cache: undefined,
        verifyOptions: { maxTokenAge: 300 },
      });

      expect(ctx.aegis.verify).toHaveBeenCalledWith(TOKEN, undefined, {
        tokenType: "access_token",
        maxTokenAge: 300,
        trustBoundThumbprint: true,
      });
    });

    // A locally verified token with no issuer to pin is a misconfiguration, not
    // a weaker check — refuse by name rather than verify against nothing.
    test("refuses when the deployment resolved no issuer", async () => {
      ctx.state.app.config = createTestAppConfig({
        auth: createTestAuthConfig({ issuer: null }),
      });

      await expect(
        resolveAccess(ctx, TOKEN, { cache: undefined, verifyOptions: {} }),
      ).rejects.toThrow(ServerError);
      expect(ctx.aegis.verify).not.toHaveBeenCalled();
    });
  });

  describe("opaque arm", () => {
    test("introspects and never verifies locally", async () => {
      ctx.auth.introspect.mockResolvedValue({
        active: true,
        custom: { tier: "gold" },
        subject: "alice",
        tokenType: "Bearer",
      });

      const result = await resolveAccess(ctx, OPAQUE_TOKEN, {
        cache: undefined,
        verifyOptions: {},
      });

      expect(ctx.aegis.verify).not.toHaveBeenCalled();
      expect(result.access.provenance).toBe("introspected");
      expect(result.access.custom).toEqual({ tier: "gold" });
      expect(result.issuer).toBe(ISSUER);
      // No VerifiedToken exists behind an introspection answer.
      expect(result.verified).toBeUndefined();
    });

    // `active` and `tokenType` describe the ANSWER, not the token. Neither has a
    // counterpart on the verified arm, so neither may reach the resolved claims.
    test("keeps the RFC 7662 response members out of the claims", async () => {
      ctx.auth.introspect.mockResolvedValue({
        active: true,
        custom: {},
        subject: "alice",
        tokenType: "Bearer",
      });

      const result = await resolveAccess(ctx, OPAQUE_TOKEN, {
        cache: undefined,
        verifyOptions: {},
      });

      expect(result.access.claims).toEqual({ subject: "alice" });
    });

    test("passes the mount's cache carve-out through", async () => {
      ctx.auth.introspect.mockResolvedValue({ active: true, custom: {} });

      await resolveAccess(ctx, OPAQUE_TOKEN, { cache: false, verifyOptions: {} });

      expect(ctx.auth.introspect).toHaveBeenCalledWith(OPAQUE_TOKEN, { cache: false });
    });

    test("refuses an inactive answer", async () => {
      ctx.auth.introspect.mockResolvedValue({ active: false });

      await expect(
        resolveAccess(ctx, OPAQUE_TOKEN, { cache: undefined, verifyOptions: {} }),
      ).rejects.toThrow(expect.objectContaining({ code: "token_not_active" }));
    });

    test("refuses by name when the driver cannot introspect", async () => {
      ctx.state.app.config = createTestAppConfig({
        auth: createTestAuthConfig({
          capabilities: { introspect: false, userinfo: false },
        }),
      });

      await expect(
        resolveAccess(ctx, OPAQUE_TOKEN, { cache: undefined, verifyOptions: {} }),
      ).rejects.toThrow(
        expect.objectContaining({ code: "opaque_token_not_supported", status: 401 }),
      );
      expect(ctx.auth.introspect).not.toHaveBeenCalled();
    });

    // RFC 7662 makes the authorization server the authority on an opaque
    // credential, so a deployment that settled no issuer still resolves one.
    test("resolves with a null issuer when the deployment settled none", async () => {
      ctx.state.app.config = createTestAppConfig({
        auth: createTestAuthConfig({ issuer: null }),
      });
      ctx.auth.introspect.mockResolvedValue({ active: true, custom: {}, subject: "a" });

      const result = await resolveAccess(ctx, OPAQUE_TOKEN, {
        cache: undefined,
        verifyOptions: {},
      });

      expect(result.issuer).toBeNull();
      expect(result.access.provenance).toBe("introspected");
    });

    // `currentDate` is a verify KNOB, and the introspected arm honours it for its
    // own temporal check so a test (or a replay) can pin "now" for both arms.
    test("honours currentDate for the introspect-only temporal check", async () => {
      ctx.auth.introspect.mockResolvedValue({
        active: true,
        custom: {},
        expiresAt: new Date("2026-08-10T12:00:00.000Z"),
      });

      await expect(
        resolveAccess(ctx, OPAQUE_TOKEN, {
          cache: undefined,
          verifyOptions: { currentDate: new Date("2026-08-10T11:59:00.000Z") },
        }),
      ).resolves.toMatchObject({ access: { provenance: "introspected" } });

      await expect(
        resolveAccess(ctx, OPAQUE_TOKEN, {
          cache: undefined,
          verifyOptions: { currentDate: new Date("2026-08-10T12:01:00.000Z") },
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "token_not_active" }));
    });
  });

  // Both arms produce the SAME four fields, keyed the same way. This is the
  // assumption every shared step downstream is built on.
  test("both arms produce the same access shape", async () => {
    const claims = { subject: "alice", scope: ["openid"], issuer: ISSUER };

    (ctx.aegis.verify as Mock).mockResolvedValue({
      claims,
      custom: {},
      format: "jwt",
      token: TOKEN,
    });
    const verified = await resolveAccess(ctx, TOKEN, {
      cache: undefined,
      verifyOptions: {},
    });

    ctx.auth.introspect.mockResolvedValue({ active: true, custom: {}, ...claims });
    const introspected = await resolveAccess(ctx, OPAQUE_TOKEN, {
      cache: undefined,
      verifyOptions: {},
    });

    expect(Object.keys(verified.access).sort()).toEqual(
      Object.keys(introspected.access).sort(),
    );
    expect(introspected.access.claims).toEqual(verified.access.claims);
    expect(introspected.issuer).toBe(verified.issuer);
  });
});
