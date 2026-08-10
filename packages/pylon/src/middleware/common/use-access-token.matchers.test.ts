import type { IAegis } from "@lindorm/aegis";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeAll, beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import {
  ACCESS_TEST_ISSUER,
  createTestAegis,
  mintTestAccessToken,
} from "../../__fixtures__/access/aegis.js";
import {
  ACCESS_TEST_AUDIENCE,
  OPAQUE_TOKEN,
  introspectionAnswer,
} from "../../__fixtures__/access/tokens.js";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../__fixtures__/app-config.js";
import { useAccessToken } from "./use-access-token.js";

const APP_CONFIG = createTestAppConfig({
  auth: createTestAuthConfig({ issuer: ACCESS_TEST_ISSUER }),
});

/** This resource server's own identity — what every mount here declares. */
const SELF = ACCESS_TEST_AUDIENCE;
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
 * ⚠ The two arms now refuse a wrong AUDIENCE for different reasons, and the pair
 * is what proves both do it. `audience` is a REQUIRED mount option and is handed
 * to the `access_token` profile floor, so the structured arm refuses inside
 * verify (RFC 9068 §4); the introspected arm has no profile, so its audience is
 * an ordinary matcher in the shared assert. Same verdict, two mechanisms, one
 * stated audience.
 *
 * ⚠ `audience` is a SCALAR matcher against an ARRAY-valued claim ("aud contains
 * this one identity"). That is the form a resource server writes for itself, and
 * it is the form `Aegis.assert` refused until the registry-driven lift landed —
 * so an audience gate applied to `ctx.state.access.claims` would have refused
 * every correctly self-audienced token. Both halves had to be true before this
 * could be closed, which is why the ACCEPT cases below matter as much as the
 * REJECT ones.
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

  /**
   * A REAL signed access token — the structured arm resolves it locally.
   *
   * ⚠ Exactly ONE audience. The `access_token` profile resolves `aud` to a single
   * resource (RFC 9068 + ADR-0014) and refuses to MINT a multi-audience token, so
   * the "aud contains this one among several" shape is only expressible on the
   * introspected arm below.
   */
  const mintJwt = (claims: Record<string, unknown>): Promise<string> =>
    mintTestAccessToken(aegis, claims);

  /** The introspection answer for the opaque handle, in domain form. */
  const introspects = (ctx: any, claims: Record<string, unknown>): void => {
    ctx.auth.introspect.mockResolvedValue(
      introspectionAnswer({ issuer: ACCESS_TEST_ISSUER, ...claims }),
    );
  };

  beforeAll(() => {
    aegis = createTestAegis(createMockLogger());
  });

  beforeEach(() => {
    next = vi.fn();
  });

  describe("audience", () => {
    // ⚠ EXPECTATION FLIPPED — same refusal, different reason. `audience` is now
    // handed to the profiled verify, so RFC 9068 §4's "aud MUST contain the
    // resource server's identity" refuses the token inside `verifyAccessToken`,
    // before the shared assert ever sees it. It used to reach the assert and come
    // back as `access_token_claims_invalid`.
    test("VERIFIED: refuses a token audienced elsewhere", async () => {
      const ctx = makeCtx(await mintJwt({ audience: [ELSEWHERE] }));

      await expect(useAccessToken({ audience: SELF })(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "access_token_verification_failed",
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

    test("VERIFIED: accepts a token whose aud is this resource", async () => {
      const ctx = makeCtx(await mintJwt({ audience: [SELF] }));

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
    //
    // ⚠ INTROSPECTED ONLY, and not by choice: the structured arm cannot present
    // this shape at all. `audience` is in the `access_token` profile's `required`
    // set, so a token without one cannot be minted, and the verify floor rejects
    // one unconditionally before any matcher runs.
    test("INTROSPECTED: refuses a handle with no audience at all", async () => {
      const ctx = makeCtx(OPAQUE_TOKEN);
      const { audience: _none, ...noAudience } = introspectionAnswer({
        issuer: ACCESS_TEST_ISSUER,
      });
      ctx.auth.introspect.mockResolvedValue(noAudience);

      await expect(useAccessToken({ audience: SELF })(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "access_token_claims_invalid",
        data: { invalid: ["audience"] },
      });
      expect(next).not.toHaveBeenCalled();
    });
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
   * ⚠ The issuer is the OPTIONAL-BOUND idiom on both arms
   * (`$or: [{ $exists: false }, { $eq }]`): an ABSENT `iss` passes, a
   * CONTRADICTING one does not. RFC 7662 §2.2 makes it a MAY, and the credential
   * is already pinned without it — pylon called a SPECIFIC issuer's introspection
   * endpoint, resolved before both arms, so WHICH authority answered is the pin
   * and the claim is corroboration on top of it.
   *
   * The bound only ever relaxes the INTROSPECTED arm. A structured credential
   * answers to `iss` twice over before the matchers run: the deployment's issuer
   * scopes the key lookup, and the `access_token` profile floor exact-matches the
   * claim and lists `issuer` in its required set.
   */
  describe("issuer", () => {
    test("VERIFIED: a token from another issuer is refused inside verify", async () => {
      // The deployment pins an issuer this token does not carry. That issuer now
      // SCOPES the key lookup as well as the floor's `iss` comparison, so the
      // refusal happens inside `verifyAccessToken` rather than in the shared
      // assert — a colliding `kid` from another registered issuer can never
      // produce a valid signature.
      const ctx = makeCtx(await mintJwt({ audience: [SELF] }));
      ctx.state.app.config = createTestAppConfig({
        auth: createTestAuthConfig({ issuer: "https://elsewhere.test.lindorm.io" }),
      });

      await expect(useAccessToken({ audience: SELF })(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "access_token_verification_failed",
      });
      expect(next).not.toHaveBeenCalled();
    });

    // ⚠ EXPECTATION FLIPPED BACK. A hard `$eq` refused this, which is a
    // spec-conformant answer (RFC 7662 §2.2 makes `iss` a MAY) and cost nothing
    // to refuse — see the note above.
    test("INTROSPECTED: an answer with no iss is served", async () => {
      const ctx = makeCtx(OPAQUE_TOKEN);
      const { issuer: _none, ...noIssuer } = introspectionAnswer({ audience: [SELF] });
      ctx.auth.introspect.mockResolvedValue(noIssuer);

      await expect(
        useAccessToken({ audience: SELF })(ctx, next),
      ).resolves.toBeUndefined();
      expect(ctx.state.access.provenance).toBe("introspected");
      expect(next).toHaveBeenCalledTimes(1);
    });

    // …and an answer that states a DIFFERENT issuer is refused the same way.
    test("INTROSPECTED: an answer naming a different iss is refused", async () => {
      const ctx = makeCtx(OPAQUE_TOKEN);
      introspects(ctx, { issuer: "https://elsewhere.test.lindorm.io", audience: [SELF] });

      await expect(useAccessToken({ audience: SELF })(ctx, next)).rejects.toMatchObject({
        status: 401,
        data: { invalid: ["issuer"] },
      });
      expect(next).not.toHaveBeenCalled();
    });

    // ⚠ EXPECTATION FLIPPED. A deployment that settled no issuer used to resolve
    // opaque credentials with no issuer matcher at all. `resolveAccessIssuer` now
    // runs BEFORE both arms and refuses the request by name: an absent issuer is
    // not a weaker check, it is NO check, and it is a deployment fault (500), not
    // a bad credential.
    test("INTROSPECTED: no issuer resolved refuses the request outright", async () => {
      const ctx = makeCtx(OPAQUE_TOKEN);
      ctx.state.app.config = createTestAppConfig({
        auth: createTestAuthConfig({ issuer: null }),
      });
      introspects(ctx, { issuer: "https://whoever.test.lindorm.io", audience: [SELF] });

      await expect(useAccessToken({ audience: SELF })(ctx, next)).rejects.toMatchObject({
        code: "access_issuer_unresolved",
        type: "urn:lindorm:pylon:error:access_issuer_unresolved",
        data: { auth: "unresolved" },
      });
      expect(ctx.auth.introspect).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
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
