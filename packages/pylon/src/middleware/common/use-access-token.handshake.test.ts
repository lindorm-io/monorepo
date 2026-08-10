import { AegisError } from "@lindorm/aegis";
import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  createDpopTestClient,
  type DpopTestClient,
} from "../../__fixtures__/access/dpop.js";
import {
  ACCESS_MOUNT,
  accessClaims,
  joseShapedToken,
} from "../../__fixtures__/access/tokens.js";
import { useAccessToken } from "./use-access-token.js";
import { beforeAll, beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../__fixtures__/app-config.js";

const APP_CONFIG = createTestAppConfig({ auth: createTestAuthConfig() });

/**
 * ⚠ A JOSE-SHAPED token, not the bare string `"jwt-token"` this suite used to
 * present. The handshake arm now runs the same claims-bearing SNIFF as HTTP, and
 * a bare handle is routed to introspection — which is what these tests are NOT
 * about. The old fixture only ever reached `aegis.verify` because the handshake
 * arm called it unconditionally.
 */
const TOKEN = joseShapedToken();

/**
 * The credential a refresh swaps IN. It must be a real JOSE wire, not a bare
 * label: `resolveAccess` SNIFFS the token to pick its arm, so `"new-jwt"` would
 * quietly take the INTROSPECTED arm and make every "the refresh re-verified it"
 * assertion below untrue.
 */
const REFRESHED = joseShapedToken({ sub: "alice", refreshed: true });

/**
 * A well-clear expiry. Every mocked verify answer travels through the SHARED
 * `assertResolvedAccess`, which applies `Aegis.assert`'s default temporal range —
 * so a present `expiresAt` is really range-checked, and a claims fixture minted
 * "now" or in a fixed past month is rejected rather than merely stale.
 */
const LIVE_EXPIRY = new Date("2099-04-11T12:05:00.000Z");

const makeCtx = (overrides: any = {}): any => {
  const aegis = createMockAegis();
  return {
    aegis,
    auth: { introspect: vi.fn() },
    logger: createMockLogger(),
    handshakeId: "hsk-1",
    state: { access: null, app: { config: APP_CONFIG }, tokens: {} },
    io: {
      socket: {
        handshake: {
          auth: {},
          headers: { host: "api.example.com" },
          secure: true,
          url: "/socket.io/?EIO=4&transport=websocket",
        },
        data: {
          app: {},
          tokens: {},
          pylon: {},
          ...overrides.data,
        },
        ...overrides.socket,
      },
    },
  };
};

describe("useAccessToken — socket handshake", () => {
  let next: Mock;

  beforeEach(() => {
    next = vi.fn();
  });

  describe("bearer path", () => {
    // ⚠ FIXTURE FIXED, ASSERTION UNTOUCHED. This mocked an `expiresAt` of
    // 2026-04-11T12:05 against the REAL clock, so by the time the shared assert
    // started range-checking temporal claims the token was months expired and the
    // check correctly refused it. The clock is pinned instead of the expiry being
    // pushed out, so the temporal range still has something to say here.
    test("verifies bearer and registers bearer strategy auth", async () => {
      vi.useFakeTimers().setSystemTime(new Date("2026-04-11T12:00:00.000Z"));

      try {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = TOKEN;

        const exp = new Date("2026-04-11T12:05:00.000Z");
        (ctx.aegis.verify as Mock).mockResolvedValue({
          claims: accessClaims({ expiresAt: exp }),
          custom: {},
          header: { tokenType: "access_token" },
          token: TOKEN,
        });

        const mw = useAccessToken(ACCESS_MOUNT);
        await mw(ctx, next);

        expect(ctx.io.socket.data.pylon.access.provenance).toBe("verified");
        expect(ctx.io.socket.data.tokens.bearer).toMatchSnapshot();
        expect(ctx.io.socket.data.pylon.auth.strategy).toBe("bearer");
        expect(ctx.io.socket.data.pylon.auth.getExpiresAt()).toEqual(exp);
        expect(ctx.io.socket.data.pylon.auth.authExpiredEmittedAt).toBeNull();
        expect(next).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    // The handshake shares the middleware's error contract now: a raw failure
    // out of aegis is an unauthenticated CLIENT, not a 500. It used to escape
    // the old handshake factory unwrapped, so socket.io saw a bare `Error` with
    // no status and the connection error handler logged it as a server fault.
    test("wraps a raw verification failure as an unauthorized client error", async () => {
      const ctx = makeCtx();
      ctx.io.socket.handshake.auth.bearer = TOKEN;
      (ctx.aegis.verify as Mock).mockRejectedValue(new Error("bad signature"));

      const mw = useAccessToken(ACCESS_MOUNT);
      await expect(mw(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "access_token_verification_failed",
        type: "urn:lindorm:pylon:error:access_token_verification_failed",
      });
      expect(next).not.toHaveBeenCalled();
    });

    // …and a named ClientError from the DPoP checks passes through UNCHANGED —
    // wrapping every failure into one code would erase the reason.
    test("passes a named client error through unwrapped", async () => {
      const ctx = makeCtx();
      ctx.io.socket.handshake.auth.bearer = TOKEN;

      const mw = useAccessToken({ ...ACCESS_MOUNT, dpop: "required" });
      await expect(mw(ctx, next)).rejects.toMatchObject({
        code: "handshake_dpop_proof_required",
      });
    });

    // ⚠ The mount's matchers are re-applied to the REFRESHED credential, so a
    // refresh cannot widen the grant. That runs before the subject/jkt continuity
    // checks, which is why every refreshed answer below states the claim floor.
    test("bearer refresh handler swaps token and clears authExpiredEmittedAt", async () => {
      vi.useFakeTimers().setSystemTime(new Date("2026-04-11T12:00:00.000Z"));

      try {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = TOKEN;

        const initExp = new Date("2026-04-11T12:05:00.000Z");
        (ctx.aegis.verify as Mock).mockResolvedValueOnce({
          claims: accessClaims({ expiresAt: initExp }),
          custom: {},
          header: {},
          token: TOKEN,
        });

        const mw = useAccessToken(ACCESS_MOUNT);
        await mw(ctx, next);

        (ctx.aegis.verify as Mock).mockResolvedValueOnce({
          claims: accessClaims({ expiresAt: new Date("2026-04-11T23:59:59.000Z") }),
          custom: {},
          header: {},
          token: REFRESHED,
        });

        ctx.io.socket.data.pylon.auth.authExpiredEmittedAt = new Date();

        await ctx.io.socket.data.pylon.auth.refresh({
          bearer: REFRESHED,
          expiresIn: 3600,
        });

        expect(ctx.io.socket.data.tokens.bearer).toMatchSnapshot();
        expect(ctx.io.socket.data.pylon.auth.getExpiresAt()).toEqual(
          new Date("2026-04-11T13:00:00.000Z"),
        );
        expect(ctx.io.socket.data.pylon.auth.authExpiredEmittedAt).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    test("bearer refresh handler throws on subject mismatch", async () => {
      const ctx = makeCtx();
      ctx.io.socket.handshake.auth.bearer = TOKEN;

      (ctx.aegis.verify as Mock).mockResolvedValueOnce({
        claims: accessClaims({ expiresAt: LIVE_EXPIRY }),
        custom: {},
        header: {},
        token: TOKEN,
      });

      const mw = useAccessToken(ACCESS_MOUNT);
      await mw(ctx, next);

      // Clears the claim floor and the temporal range, so the ONLY thing left to
      // refuse it is the subject continuity check.
      (ctx.aegis.verify as Mock).mockResolvedValueOnce({
        claims: accessClaims({ subject: "bob", expiresAt: LIVE_EXPIRY }),
        custom: {},
        header: {},
        token: REFRESHED,
      });

      await expect(
        ctx.io.socket.data.pylon.auth.refresh({ bearer: REFRESHED, expiresIn: 3600 }),
      ).rejects.toThrow(ClientError);
    });
  });

  describe("session fallback path", () => {
    const session = {
      id: "sess-1",
      accessToken: "session-jwt",
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      issuedAt: new Date(),
      scope: ["openid"],
      subject: "alice",
    } as any;

    test("registers session strategy when socket.data.session present", async () => {
      const ctx = makeCtx({ data: { session } });
      (ctx.aegis.verify as Mock).mockResolvedValue({
        claims: accessClaims({ expiresAt: session.expiresAt }),
        custom: {},
        format: "jwt",
        token: "session-jwt",
      });

      const mw = useAccessToken(ACCESS_MOUNT);
      await mw(ctx, next);

      expect(ctx.io.socket.data.pylon.auth.strategy).toBe("session");
      expect(ctx.io.socket.data.pylon.auth.getExpiresAt()).toEqual(session.expiresAt);
      expect(ctx.io.socket.data.tokens.bearer).toMatchSnapshot();
      expect(next).toHaveBeenCalledTimes(1);
    });

    // ⚠ NEW REFUSAL. The handshake session arm now runs the SAME
    // `assertResolvedAccess` the header arms run, so a mount's matchers are no
    // longer a silent no-op for a cookie-presented credential.
    test("applies the mount's matchers to a session credential", async () => {
      const ctx = makeCtx({ data: { session } });
      (ctx.aegis.verify as Mock).mockResolvedValue({
        claims: accessClaims({
          audience: ["https://other.test.lindorm.io"],
          expiresAt: session.expiresAt,
        }),
        custom: {},
        format: "jwt",
        token: "session-jwt",
      });

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "access_token_claims_invalid",
        data: { invalid: ["audience"], provenance: "verified" },
      });
      expect(ctx.io.socket.data.pylon.auth).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });

    /**
     * A DPoP-BOUND session credential cannot be asserted here, and no
     * `assertDpopBinding` call exists on this arm — one would be UNREACHABLE.
     * `extractTokenFromSession` verifies with aegis's RFC 9449-strict default
     * (no `trustBoundThumbprint`), so a `cnf.jkt` token with no proof never
     * verifies, `parsed` is `null`, and the block that builds an access to check
     * is never entered. The HTTP twin proves that against a REAL Aegis in
     * `use-access-token.session.test.ts`; a mocked `aegis.verify` here would
     * simply hand back claims aegis would never have produced.
     *
     * ⚠ What this arm DOES is register a session strategy with no resolved
     * access — matching the auto-wired connection-session middleware, which has
     * no mount and therefore no matchers to apply. The socket connects and then
     * fails `missing_handshake_access` on its first event.
     */
    test("a session token aegis refuses leaves the strategy registered but no access", async () => {
      const ctx = makeCtx({ data: { session } });
      (ctx.aegis.verify as Mock).mockRejectedValue(new AegisError("bound, no proof"));

      await expect(useAccessToken(ACCESS_MOUNT)(ctx, next)).resolves.toBeUndefined();

      expect(ctx.io.socket.data.pylon.auth.strategy).toBe("session");
      expect(ctx.io.socket.data.pylon.access).toBeUndefined();
      expect(ctx.io.socket.data.tokens.bearer).toBeUndefined();
    });

    test("does not overwrite pre-registered auth (e.g. from session middleware)", async () => {
      const preAuth = {
        strategy: "session" as const,
        getExpiresAt: () => session.expiresAt,
        refresh: vi.fn(async () => {}),
        authExpiredEmittedAt: null,
      };

      const ctx = makeCtx({
        data: { session, pylon: { auth: preAuth } },
      });

      const mw = useAccessToken(ACCESS_MOUNT);
      await mw(ctx, next);

      expect(ctx.io.socket.data.pylon.auth).toBe(preAuth);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("session refresh handler updates state from re-read session", async () => {
      const ctx = makeCtx({ data: { session } });
      (ctx.aegis.verify as Mock).mockResolvedValue({
        claims: accessClaims({ expiresAt: session.expiresAt }),
        custom: {},
        format: "jwt",
        token: "session-jwt",
      });

      const mw = useAccessToken(ACCESS_MOUNT);
      await mw(ctx, next);

      ctx.io.socket.data.pylon.auth.authExpiredEmittedAt = new Date();
      await ctx.io.socket.data.pylon.auth.refresh({});

      expect(ctx.io.socket.data.pylon.auth.authExpiredEmittedAt).toBeNull();
    });

    test("session refresh handler throws when the session has expired", async () => {
      // We exercise the session-lookup-null scenario directly on
      // createSessionRefreshHandler in its own test; here we assert the
      // middleware-installed handler refuses a session that has since expired.
      //
      // ⚠ The SESSION's expiry is in the past, the TOKEN's is not. They are
      // separate fields, and they have to be: the handshake now range-checks the
      // token's claims through the shared assert, so a token-expiry fixture would
      // fail the middleware itself and never reach the refresh handler.
      const pastSession = {
        ...session,
        expiresAt: new Date("2000-01-01T00:00:00.000Z"),
      };
      const ctx = makeCtx({ data: { session: pastSession } });
      (ctx.aegis.verify as Mock).mockResolvedValue({
        claims: accessClaims({ expiresAt: LIVE_EXPIRY }),
        custom: {},
        format: "jwt",
        token: "session-jwt",
      });

      const mw = useAccessToken(ACCESS_MOUNT);
      await mw(ctx, next);

      await expect(ctx.io.socket.data.pylon.auth.refresh({})).rejects.toMatchObject({
        status: 401,
        code: "session_expired",
      });
    });
  });

  /**
   * ⚠ REAL proofs, signed by a real client key. Pylon now runs the RFC 9449 §7.1
   * proof check ITSELF (`Aegis.verifyDpopProof`, a static — the mocked instance
   * cannot stand in for it) against the RECONSTRUCTED handshake `htu`, instead of
   * handing the proof to `aegis.verify` and comparing what came back. That is the
   * same check the HTTP arm runs, which is what extends proof-of-possession to a
   * DPoP-bound OPAQUE credential over a socket.
   */
  describe("DPoP path", () => {
    const HANDSHAKE_HTU = "https://api.example.com/socket.io/";

    let client: DpopTestClient;

    beforeAll(async () => {
      client = await createDpopTestClient();
    });

    const boundVerifyResult = (overrides: any = {}) => ({
      claims: accessClaims({
        expiresAt: LIVE_EXPIRY,
        confirmation: { thumbprint: client.jkt },
        ...overrides.claims,
      }),
      custom: {},
      header: { tokenType: "access_token" },
      token: TOKEN,
    });

    const unboundVerifyResult = () => ({
      claims: accessClaims({ expiresAt: LIVE_EXPIRY }),
      custom: {},
      header: {},
      token: TOKEN,
    });

    const proofFor = (uri = HANDSHAKE_HTU, accessToken = TOKEN) =>
      client.sign({ method: "GET", uri, accessToken });

    describe('dpop: "required"', () => {
      test("rejects when DPoP header is missing", async () => {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = TOKEN;

        const mw = useAccessToken({ ...ACCESS_MOUNT, dpop: "required" });
        await expect(mw(ctx, next)).rejects.toMatchObject({
          code: "handshake_dpop_proof_required",
        });
        expect(ctx.aegis.verify).not.toHaveBeenCalled();
      });

      test("rejects when bearer-only token (no cnf.jkt) is presented", async () => {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = TOKEN;
        ctx.io.socket.handshake.headers.dpop = await proofFor();
        (ctx.aegis.verify as Mock).mockResolvedValue(unboundVerifyResult());

        const mw = useAccessToken({ ...ACCESS_MOUNT, dpop: "required" });
        await expect(mw(ctx, next)).rejects.toMatchObject({
          code: "handshake_dpop_binding_missing",
        });
      });

      test("accepts jkt-bound token + valid proof, strategy = dpop-bearer", async () => {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = TOKEN;
        ctx.io.socket.handshake.headers.dpop = await proofFor();
        (ctx.aegis.verify as Mock).mockResolvedValue(boundVerifyResult());

        const mw = useAccessToken({ ...ACCESS_MOUNT, dpop: "required" });
        await mw(ctx, next);

        // ⚠ The proof is NOT handed to aegis any more. Pylon runs the binding
        // check itself — the same `assertDpopBinding` the HTTP arm uses — so what
        // is asserted here is the VERDICT, not the arguments of the verify call.
        expect(ctx.io.socket.data.pylon.access.provenance).toBe("verified");
        expect(ctx.io.socket.data.pylon.auth.strategy).toBe("dpop-bearer");
        expect(next).toHaveBeenCalledTimes(1);
      });
    });

    describe('dpop: "optional" (default)', () => {
      test("accepts bearer-only token, strategy = bearer", async () => {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = TOKEN;
        (ctx.aegis.verify as Mock).mockResolvedValue(unboundVerifyResult());

        const mw = useAccessToken(ACCESS_MOUNT);
        await mw(ctx, next);

        expect(ctx.io.socket.data.pylon.auth.strategy).toBe("bearer");
      });

      test("accepts jkt-bound token + valid proof, strategy = dpop-bearer", async () => {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = TOKEN;
        ctx.io.socket.handshake.headers.dpop = await proofFor();
        (ctx.aegis.verify as Mock).mockResolvedValue(boundVerifyResult());

        const mw = useAccessToken(ACCESS_MOUNT);
        await mw(ctx, next);

        expect(ctx.io.socket.data.pylon.auth.strategy).toBe("dpop-bearer");
      });

      test("rejects jkt-bound token without proof (strict per token)", async () => {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = TOKEN;
        (ctx.aegis.verify as Mock).mockResolvedValue(boundVerifyResult());

        const mw = useAccessToken(ACCESS_MOUNT);
        await expect(mw(ctx, next)).rejects.toMatchObject({
          code: "missing_dpop_proof",
        });
      });

      test("rejects invalid DPoP proof (htu mismatch)", async () => {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = TOKEN;
        ctx.io.socket.handshake.headers.dpop = await proofFor(
          "https://evil.example.com/socket.io/",
        );
        (ctx.aegis.verify as Mock).mockResolvedValue(boundVerifyResult());

        const mw = useAccessToken(ACCESS_MOUNT);
        await expect(mw(ctx, next)).rejects.toMatchObject({
          code: "dpop_htu_mismatch",
        });
      });

      // The §7 `ath` binds the proof to the token it was presented with, so a
      // proof lifted from another exchange cannot be replayed against this one.
      test("rejects a proof signed over a different access token", async () => {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = TOKEN;
        ctx.io.socket.handshake.headers.dpop = await proofFor(
          HANDSHAKE_HTU,
          joseShapedToken({ sub: "mallory" }),
        );
        (ctx.aegis.verify as Mock).mockResolvedValue(boundVerifyResult());

        const mw = useAccessToken(ACCESS_MOUNT);
        await expect(mw(ctx, next)).rejects.toMatchObject({
          code: "invalid_dpop_proof",
        });
      });

      // The proof's own key must be the one the token is bound to.
      test("rejects a proof from a key the token is not bound to", async () => {
        const other = await createDpopTestClient();
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = TOKEN;
        ctx.io.socket.handshake.headers.dpop = await other.sign({
          method: "GET",
          uri: HANDSHAKE_HTU,
          accessToken: TOKEN,
        });
        (ctx.aegis.verify as Mock).mockResolvedValue(boundVerifyResult());

        const mw = useAccessToken(ACCESS_MOUNT);
        await expect(mw(ctx, next)).rejects.toMatchObject({
          code: "invalid_dpop_proof",
        });
      });
    });

    describe('dpop: "disabled"', () => {
      test("accepts jkt-bound token without proof as plain bearer", async () => {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = TOKEN;
        (ctx.aegis.verify as Mock).mockResolvedValue(boundVerifyResult());

        const mw = useAccessToken({ ...ACCESS_MOUNT, dpop: "disabled" });
        await mw(ctx, next);

        expect(ctx.io.socket.data.pylon.auth.strategy).toBe("bearer");
      });
    });

    describe("refresh handler with captured jkt", () => {
      const installDpopHandshake = async (ctx: any) => {
        ctx.io.socket.handshake.auth.bearer = TOKEN;
        ctx.io.socket.handshake.headers.dpop = await proofFor();
        (ctx.aegis.verify as Mock).mockResolvedValueOnce(boundVerifyResult());

        const mw = useAccessToken(ACCESS_MOUNT);
        await mw(ctx, next);
      };

      test("accepts refresh with same cnf.jkt", async () => {
        const ctx = makeCtx();
        await installDpopHandshake(ctx);

        (ctx.aegis.verify as Mock).mockResolvedValueOnce({
          claims: accessClaims({
            expiresAt: new Date("2099-04-11T13:00:00.000Z"),
            confirmation: { thumbprint: client.jkt },
          }),
          custom: {},
          header: {},
          token: REFRESHED,
        });

        await expect(
          ctx.io.socket.data.pylon.auth.refresh({
            bearer: REFRESHED,
            expiresIn: 3600,
          }),
        ).resolves.toBeUndefined();
      });

      test("rejects refresh with a different cnf.jkt", async () => {
        const ctx = makeCtx();
        await installDpopHandshake(ctx);

        (ctx.aegis.verify as Mock).mockResolvedValueOnce({
          claims: accessClaims({
            expiresAt: LIVE_EXPIRY,
            confirmation: { thumbprint: "jkt-xyz" },
          }),
          custom: {},
          header: {},
          token: REFRESHED,
        });

        await expect(
          ctx.io.socket.data.pylon.auth.refresh({
            bearer: REFRESHED,
            expiresIn: 3600,
          }),
        ).rejects.toThrow(ClientError);
      });

      test("rejects refresh when new token has no cnf.jkt", async () => {
        const ctx = makeCtx();
        await installDpopHandshake(ctx);

        (ctx.aegis.verify as Mock).mockResolvedValueOnce({
          claims: accessClaims({ expiresAt: LIVE_EXPIRY }),
          custom: {},
          header: {},
          token: REFRESHED,
        });

        await expect(
          ctx.io.socket.data.pylon.auth.refresh({
            bearer: REFRESHED,
            expiresIn: 3600,
          }),
        ).rejects.toThrow(ClientError);
      });
    });
  });

  describe("no credentials", () => {
    test("throws Unauthorized when neither header nor session present", async () => {
      const ctx = makeCtx();
      const mw = useAccessToken(ACCESS_MOUNT);

      await expect(mw(ctx, next)).rejects.toThrow(ClientError);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
