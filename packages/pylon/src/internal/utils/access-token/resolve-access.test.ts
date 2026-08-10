import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { ServerError } from "@lindorm/errors";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import {
  ACCESS_TEST_APP_ISSUER,
  ACCESS_TEST_AUDIENCE,
  OPAQUE_TOKEN,
  accessClaims,
  introspectionAnswer,
  joseShapedToken,
  verifiedAccess,
} from "../../../__fixtures__/access/tokens.js";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../../__fixtures__/app-config.js";
import { resolveAccess } from "./resolve-access.js";

const TOKEN = joseShapedToken();

/**
 * What a caller states; the issuer is the deployment's, not the mount's.
 * `scheme` is the RFC 6749 §7.1 scheme the credential was presented under —
 * HTTP's, here, since that is the transport that has one.
 */
const OPTIONS = {
  audience: ACCESS_TEST_AUDIENCE,
  cache: undefined,
  profile: "access_token" as const,
  scheme: "bearer" as const,
};

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
        ...verifiedAccess({ subject: "alice" }, TOKEN),
        custom: { tier: "gold" },
      });
    });

    test("verifies locally and never introspects", async () => {
      const result = await resolveAccess(ctx, TOKEN, OPTIONS);

      expect(ctx.auth.introspect).not.toHaveBeenCalled();
      expect(result.access.provenance).toBe("verified");
      expect(result.access.claims).toEqual(accessClaims({ subject: "alice" }));
      // The custom bucket travels beside the registered claims on both arms.
      expect(result.access.custom).toEqual({ tier: "gold" });
      expect(result.access.token).toBe(TOKEN);
      expect(result.issuer).toBe(ACCESS_TEST_APP_ISSUER);
      expect(result.verified).toBeDefined();
    });

    // ⚠ The PROFILED overload, and the three things that follow from it: the
    // profile NAME pins the `typ` floor (`application/at+jwt`, RFC 9068 §2.2)
    // beyond a mount's reach, the mount's own `audience` and the deployment's
    // resolved `issuer` are handed to the floor rather than compared afterwards
    // (`iss` scopes the KEY lookup), and `assert` is `undefined` because the
    // claim matchers are a later pass shared with the opaque arm.
    //
    // `trustBoundThumbprint` says pylon validates the DPoP binding itself, so
    // aegis must not reject a bound token for want of a proof it was not given.
    test("verifies against the access_token profile, with no assert", async () => {
      await resolveAccess(ctx, TOKEN, OPTIONS);

      expect(ctx.aegis.verify).toHaveBeenCalledWith("access_token", TOKEN, undefined, {
        audience: ACCESS_TEST_AUDIENCE,
        issuer: ACCESS_TEST_APP_ISSUER,
        trustBoundThumbprint: true,
      });
    });

    // A locally verified token with no issuer to pin is a misconfiguration, not
    // a weaker check — refuse by name rather than verify against nothing.
    test("refuses when the deployment resolved no issuer", async () => {
      ctx.state.app.config = createTestAppConfig({
        auth: createTestAuthConfig({ issuer: null }),
      });

      await expect(resolveAccess(ctx, TOKEN, OPTIONS)).rejects.toThrow(ServerError);
      expect(ctx.aegis.verify).not.toHaveBeenCalled();
    });
  });

  describe("opaque arm", () => {
    test("introspects and never verifies locally", async () => {
      ctx.auth.introspect.mockResolvedValue(
        introspectionAnswer({ custom: { tier: "gold" } }),
      );

      const result = await resolveAccess(ctx, OPAQUE_TOKEN, OPTIONS);

      expect(ctx.aegis.verify).not.toHaveBeenCalled();
      expect(result.access.provenance).toBe("introspected");
      expect(result.access.custom).toEqual({ tier: "gold" });
      expect(result.issuer).toBe(ACCESS_TEST_APP_ISSUER);
      // No VerifiedToken exists behind an introspection answer.
      expect(result.verified).toBeUndefined();
    });

    // `active` and `tokenType` describe the ANSWER, not the token. Neither has a
    // counterpart on the verified arm, so neither may reach the resolved claims.
    test("keeps the RFC 7662 response members out of the claims", async () => {
      ctx.auth.introspect.mockResolvedValue(introspectionAnswer());

      const result = await resolveAccess(ctx, OPAQUE_TOKEN, OPTIONS);

      expect(result.access.claims).toEqual(accessClaims());
    });

    test("passes the mount's cache carve-out through", async () => {
      ctx.auth.introspect.mockResolvedValue(introspectionAnswer());

      await resolveAccess(ctx, OPAQUE_TOKEN, { ...OPTIONS, cache: false });

      expect(ctx.auth.introspect).toHaveBeenCalledWith(OPAQUE_TOKEN, { cache: false });
    });

    test("refuses an inactive answer", async () => {
      ctx.auth.introspect.mockResolvedValue({ active: false });

      await expect(resolveAccess(ctx, OPAQUE_TOKEN, OPTIONS)).rejects.toThrow(
        expect.objectContaining({ code: "token_not_active" }),
      );
    });

    // ⚠ EXPECTATION FLIPPED. An answer with no `token_type` used to be refused
    // by name. RFC 7662 §2.2 makes it a MAY, so a bare answer is conformant —
    // and there was never an `at+jwt`-shaped value to compare it against
    // anyway, `token_type` being RFC 6749 §7.1's presentation scheme.
    test("accepts an active answer that states no token type", async () => {
      ctx.auth.introspect.mockResolvedValue(
        introspectionAnswer({ tokenType: undefined }),
      );

      await expect(resolveAccess(ctx, OPAQUE_TOKEN, OPTIONS)).resolves.toMatchObject({
        access: { provenance: "introspected" },
      });
    });

    // What the answer IS compared against: the scheme the request presented.
    test("refuses an answer whose token type contradicts the presented scheme", async () => {
      ctx.auth.introspect.mockResolvedValue(introspectionAnswer({ tokenType: "DPoP" }));

      await expect(resolveAccess(ctx, OPAQUE_TOKEN, OPTIONS)).rejects.toThrow(
        expect.objectContaining({
          code: "introspection_token_type_mismatch",
          status: 401,
        }),
      );
    });

    // A transport with no `Authorization` header presents no scheme, so there is
    // nothing for the answer to contradict and any stated type is accepted.
    test("accepts any stated token type when no scheme was presented", async () => {
      ctx.auth.introspect.mockResolvedValue(introspectionAnswer({ tokenType: "DPoP" }));

      await expect(
        resolveAccess(ctx, OPAQUE_TOKEN, { ...OPTIONS, scheme: undefined }),
      ).resolves.toMatchObject({ access: { provenance: "introspected" } });
    });

    test("refuses by name when the driver cannot introspect", async () => {
      ctx.state.app.config = createTestAppConfig({
        auth: createTestAuthConfig({
          capabilities: { introspect: false, userinfo: false },
        }),
      });

      await expect(resolveAccess(ctx, OPAQUE_TOKEN, OPTIONS)).rejects.toThrow(
        expect.objectContaining({ code: "opaque_token_not_supported", status: 401 }),
      );
      expect(ctx.auth.introspect).not.toHaveBeenCalled();
    });

    // ⚠ EXPECTATION FLIPPED. This arm used to resolve with `issuer: null` — RFC
    // 7662 makes the authorization server the authority, so an unpinned
    // deployment was let through. That made the opaque arm the laxer of the two:
    // the structured arm refuses the same deployment outright, and "the
    // authority answered" is not "the answer came from OUR authority". The
    // issuer is now resolved BEFORE the arms, so the driver is never even asked.
    test("refuses when the deployment settled no issuer", async () => {
      ctx.state.app.config = createTestAppConfig({
        auth: createTestAuthConfig({ issuer: null }),
      });
      ctx.auth.introspect.mockResolvedValue(introspectionAnswer());

      await expect(resolveAccess(ctx, OPAQUE_TOKEN, OPTIONS)).rejects.toThrow(
        expect.objectContaining({ code: "access_issuer_unresolved", status: 500 }),
      );
      expect(ctx.auth.introspect).not.toHaveBeenCalled();
    });

    // The temporal check is `Aegis.matches`'s DEFAULT window — the same builder
    // `aegis.verify` runs — so there is no `currentDate` knob left to pin it
    // with: the two arms read one clock. Stated against wall-clock offsets,
    // which is what a live introspection answer is measured against anyway.
    test("refuses an answer whose own exp has passed", async () => {
      ctx.auth.introspect.mockResolvedValue(
        introspectionAnswer({ expiresAt: new Date(Date.now() - 60_000) }),
      );

      await expect(resolveAccess(ctx, OPAQUE_TOKEN, OPTIONS)).rejects.toThrow(
        expect.objectContaining({ code: "token_not_active" }),
      );
    });

    test("accepts an answer whose own exp is still ahead", async () => {
      ctx.auth.introspect.mockResolvedValue(
        introspectionAnswer({ expiresAt: new Date(Date.now() + 60_000) }),
      );

      await expect(resolveAccess(ctx, OPAQUE_TOKEN, OPTIONS)).resolves.toMatchObject({
        access: { provenance: "introspected" },
      });
    });
  });

  // Both arms produce the SAME four fields, keyed the same way. This is the
  // assumption every shared step downstream is built on.
  test("both arms produce the same access shape", async () => {
    const claims = accessClaims({ scope: ["openid"] });

    (ctx.aegis.verify as Mock).mockResolvedValue(
      verifiedAccess({ scope: ["openid"] }, TOKEN),
    );
    const verified = await resolveAccess(ctx, TOKEN, OPTIONS);

    ctx.auth.introspect.mockResolvedValue(introspectionAnswer({ scope: ["openid"] }));
    const introspected = await resolveAccess(ctx, OPAQUE_TOKEN, OPTIONS);

    expect(Object.keys(verified.access).sort()).toEqual(
      Object.keys(introspected.access).sort(),
    );
    expect(verified.access.claims).toEqual(claims);
    expect(introspected.access.claims).toEqual(verified.access.claims);
    expect(introspected.issuer).toBe(verified.issuer);
  });
});
