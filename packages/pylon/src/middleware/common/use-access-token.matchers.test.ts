import type { IAegis } from "@lindorm/aegis";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeAll, beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { ACCESS_TEST_ISSUER, createTestAegis } from "../../__fixtures__/access/aegis.js";
import { OPAQUE_TOKEN } from "../../__fixtures__/access/tokens.js";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../__fixtures__/app-config.js";
import { useAccessToken } from "./use-access-token.js";

const APP_CONFIG = createTestAppConfig({
  auth: createTestAuthConfig({ issuer: ACCESS_TEST_ISSUER }),
});

const SELF = "https://api.test.lindorm.io";
const ELSEWHERE = "https://other.test.lindorm.io";

/**
 * THE CONFUSED-DEPUTY TEST.
 *
 * A mount's claim matchers used to be applied ONLY inside the locally-verified
 * arm — `splitVerifyInput` was called under `isClaimsBearingToken`, so the
 * matchers reached `aegis.verify` and nothing else. For an OPAQUE credential
 * they were a silent no-op.
 *
 * The consequence, proven downstream in a real deployment: a JWT audienced at
 * somebody else was refused, while THE OPAQUE HANDLE FOR THE SAME WRONG
 * AUDIENCE WAS SERVED. Since a client's token format is the client's own choice,
 * a mount gating on audience gated whichever clients happened to pick JWT.
 *
 * Every test here is written as a PAIR — the same claim, the same matcher, once
 * per provenance — because a check that holds on only one arm is the bug.
 *
 * ⚠ `audience` is a SCALAR matcher against an ARRAY-valued claim ("aud contains
 * this one identity", RFC 9068 §4). That is the form a resource server writes
 * for itself, and it is the form `Aegis.assert` refused until the registry-driven
 * lift landed — so an audience gate applied to `ctx.state.access.claims` would
 * have refused every correctly self-audienced token. Both halves had to be true
 * before this could be closed, which is why the ACCEPT cases below matter as
 * much as the REJECT ones.
 */
describe("useAccessToken — mount matchers apply to BOTH provenances", () => {
  let aegis: IAegis;
  let next: Mock;

  const makeCtx = (token: string): any => ({
    aegis,
    auth: { introspect: vi.fn() },
    logger: createMockLogger(),
    request: {},
    state: {
      access: null,
      app: { config: APP_CONFIG },
      authorization: { type: "bearer", value: token },
      session: null,
      tokens: {},
    },
  });

  /** A REAL signed JWT — the structured arm resolves it locally. */
  const mintJwt = async (claims: Record<string, unknown>): Promise<string> =>
    (
      await aegis.mint("default", {
        expires: "1 hour",
        subject: "alice",
        tokenType: "access_token",
        ...claims,
      } as any)
    ).token;

  /** The introspection answer for the opaque handle, in domain form. */
  const introspects = (ctx: any, claims: Record<string, unknown>): void => {
    ctx.auth.introspect.mockResolvedValue({
      active: true,
      custom: {},
      issuer: ACCESS_TEST_ISSUER,
      subject: "alice",
      ...claims,
    });
  };

  beforeAll(() => {
    aegis = createTestAegis(createMockLogger());
  });

  beforeEach(() => {
    next = vi.fn();
  });

  describe("audience", () => {
    test("VERIFIED: refuses a token audienced elsewhere", async () => {
      const ctx = makeCtx(await mintJwt({ audience: [ELSEWHERE] }));

      await expect(useAccessToken({ audience: SELF })(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "access_token_claims_invalid",
        data: { invalid: ["audience"], provenance: "verified" },
      });
      expect(ctx.state.access).toBeNull();
      expect(next).not.toHaveBeenCalled();
    });

    // ⚠ THE BUG. Before the shared assert this RESOLVED and called `next()` —
    // the same wrong audience, served because the credential was opaque.
    test("INTROSPECTED: refuses a handle audienced elsewhere", async () => {
      const ctx = makeCtx(OPAQUE_TOKEN);
      introspects(ctx, { audience: [ELSEWHERE] });

      await expect(useAccessToken({ audience: SELF })(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "access_token_claims_invalid",
        data: { invalid: ["audience"], provenance: "introspected" },
      });
      expect(ctx.state.access).toBeNull();
      expect(next).not.toHaveBeenCalled();
    });

    test("VERIFIED: accepts a token whose aud contains this resource", async () => {
      const ctx = makeCtx(await mintJwt({ audience: [SELF, ELSEWHERE] }));

      await expect(
        useAccessToken({ audience: SELF })(ctx, next),
      ).resolves.toBeUndefined();
      expect(ctx.state.access.provenance).toBe("verified");
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("INTROSPECTED: accepts a handle whose aud contains this resource", async () => {
      const ctx = makeCtx(OPAQUE_TOKEN);
      introspects(ctx, { audience: [SELF, ELSEWHERE] });

      await expect(
        useAccessToken({ audience: SELF })(ctx, next),
      ).resolves.toBeUndefined();
      expect(ctx.state.access.provenance).toBe("introspected");
      expect(next).toHaveBeenCalledTimes(1);
    });

    // A credential carrying NO audience satisfies no audience gate. The matcher
    // is "contains this one identity", and an absent claim contains nothing.
    test.each(["verified", "introspected"] as const)(
      "%s: refuses a credential with no audience at all",
      async (provenance) => {
        const ctx =
          provenance === "verified" ? makeCtx(await mintJwt({})) : makeCtx(OPAQUE_TOKEN);
        if (provenance === "introspected") introspects(ctx, {});

        await expect(useAccessToken({ audience: SELF })(ctx, next)).rejects.toMatchObject(
          { status: 401, data: { invalid: ["audience"] } },
        );
      },
    );
  });

  describe("scope", () => {
    test.each(["verified", "introspected"] as const)(
      "%s: refuses a credential missing the required scope",
      async (provenance) => {
        const ctx =
          provenance === "verified"
            ? makeCtx(await mintJwt({ audience: [SELF], scope: ["openid"] }))
            : makeCtx(OPAQUE_TOKEN);
        if (provenance === "introspected") {
          introspects(ctx, { audience: [SELF], scope: ["openid"] });
        }

        await expect(
          useAccessToken({ audience: SELF, scope: "orders:write" })(ctx, next),
        ).rejects.toMatchObject({ status: 401, data: { invalid: ["scope"] } });
        expect(next).not.toHaveBeenCalled();
      },
    );

    test.each(["verified", "introspected"] as const)(
      "%s: accepts a credential carrying the required scope",
      async (provenance) => {
        const scope = ["openid", "orders:write"];
        const ctx =
          provenance === "verified"
            ? makeCtx(await mintJwt({ audience: [SELF], scope }))
            : makeCtx(OPAQUE_TOKEN);
        if (provenance === "introspected") introspects(ctx, { audience: [SELF], scope });

        await expect(
          useAccessToken({ audience: SELF, scope: "orders:write" })(ctx, next),
        ).resolves.toBeUndefined();
        expect(next).toHaveBeenCalledTimes(1);
      },
    );
  });

  /**
   * The issuer matcher is the OPTIONAL-BOUND idiom, and it is correct for both
   * arms for different reasons — strict where the claim is guaranteed, tolerant
   * where the RFC makes it optional.
   */
  describe("issuer", () => {
    test("VERIFIED: a structured token always carries iss, so the check is hard", async () => {
      // Minted by a DIFFERENT aegis, so its `iss` is not the one this deployment
      // pins. The signature still verifies — the key is registered under the
      // other issuer — so what refuses it is the issuer matcher, not the crypto.
      const other = createTestAegis(createMockLogger());
      const foreign = await other.mint("default", {
        audience: [SELF],
        expires: "1 hour",
        subject: "alice",
        tokenType: "access_token",
      });

      const ctx = makeCtx(foreign.token);
      ctx.state.app.config = createTestAppConfig({
        auth: createTestAuthConfig({ issuer: "https://elsewhere.test.lindorm.io" }),
      });

      await expect(useAccessToken()(ctx, next)).rejects.toMatchObject({ status: 401 });
      expect(next).not.toHaveBeenCalled();
    });

    // RFC 7662 §2.2 makes every response member a MAY, `iss` included — and the
    // issuer is already established by WHICH endpoint was called. An answer that
    // omits it is not a mismatch.
    test("INTROSPECTED: an answer with no iss is accepted", async () => {
      const ctx = makeCtx(OPAQUE_TOKEN);
      ctx.auth.introspect.mockResolvedValue({
        active: true,
        custom: {},
        subject: "alice",
        audience: [SELF],
      });

      await expect(
        useAccessToken({ audience: SELF })(ctx, next),
      ).resolves.toBeUndefined();
      expect(ctx.state.access.provenance).toBe("introspected");
    });

    // …but an answer that DOES state an issuer must state ours.
    test("INTROSPECTED: an answer naming a different iss is refused", async () => {
      const ctx = makeCtx(OPAQUE_TOKEN);
      introspects(ctx, { issuer: "https://elsewhere.test.lindorm.io", audience: [SELF] });

      await expect(useAccessToken({ audience: SELF })(ctx, next)).rejects.toMatchObject({
        status: 401,
        data: { invalid: ["issuer"] },
      });
      expect(next).not.toHaveBeenCalled();
    });

    // A deployment that settled no issuer still resolves opaque credentials —
    // there is simply nothing to pin them to — and must not start failing now
    // that the assert is shared.
    test("INTROSPECTED: no issuer resolved means no issuer matcher", async () => {
      const ctx = makeCtx(OPAQUE_TOKEN);
      ctx.state.app.config = createTestAppConfig({
        auth: createTestAuthConfig({ issuer: null }),
      });
      introspects(ctx, { issuer: "https://whoever.test.lindorm.io", audience: [SELF] });

      await expect(
        useAccessToken({ audience: SELF })(ctx, next),
      ).resolves.toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // The failing claim VALUES are server-side only — a 401 body naming the values
  // it wanted is a probe oracle.
  test("reports the failing claim KEYS to the client and the values only in debug", async () => {
    const ctx = makeCtx(OPAQUE_TOKEN);
    introspects(ctx, { audience: [ELSEWHERE] });

    try {
      await useAccessToken({ audience: SELF })(ctx, next);
      expect.fail("expected useAccessToken to throw");
    } catch (error: any) {
      expect(error.data.invalid).toEqual(["audience"]);
      expect(JSON.stringify(error.data)).not.toContain(ELSEWHERE);
      expect(JSON.stringify(error.debug)).toContain(ELSEWHERE);
    }
  });
});
