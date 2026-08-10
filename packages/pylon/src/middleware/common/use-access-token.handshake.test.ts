import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  createDpopTestClient,
  type DpopTestClient,
} from "../../__fixtures__/access/dpop.js";
import { OPAQUE_TOKEN, joseShapedToken } from "../../__fixtures__/access/tokens.js";
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

/** The verify KNOBS every structured handshake resolve passes now. */
const VERIFY_OPTIONS = { tokenType: "access_token", trustBoundThumbprint: true };

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
    test("verifies bearer and registers bearer strategy auth", async () => {
      const ctx = makeCtx();
      ctx.io.socket.handshake.auth.bearer = TOKEN;

      const exp = new Date("2026-04-11T12:05:00.000Z");
      (ctx.aegis.verify as Mock).mockResolvedValue({
        claims: { subject: "alice", expiresAt: exp },
        header: { tokenType: "access_token" },
        token: TOKEN,
      });

      const mw = useAccessToken();
      await mw(ctx, next);

      expect(ctx.aegis.verify).toHaveBeenCalledWith(TOKEN, undefined, VERIFY_OPTIONS);
      expect(ctx.io.socket.data.tokens.bearer).toMatchSnapshot();
      expect(ctx.io.socket.data.pylon.auth.strategy).toBe("bearer");
      expect(ctx.io.socket.data.pylon.auth.getExpiresAt()).toEqual(exp);
      expect(ctx.io.socket.data.pylon.auth.authExpiredEmittedAt).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
    });

    // The handshake shares the middleware's error contract now: a raw failure
    // out of aegis is an unauthenticated CLIENT, not a 500. It used to escape
    // the old handshake factory unwrapped, so socket.io saw a bare `Error` with
    // no status and the connection error handler logged it as a server fault.
    test("wraps a raw verification failure as an unauthorized client error", async () => {
      const ctx = makeCtx();
      ctx.io.socket.handshake.auth.bearer = TOKEN;
      (ctx.aegis.verify as Mock).mockRejectedValue(new Error("bad signature"));

      const mw = useAccessToken();
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

      const mw = useAccessToken({ dpop: "required" });
      await expect(mw(ctx, next)).rejects.toMatchObject({
        code: "handshake_dpop_proof_required",
      });
    });

    test("bearer refresh handler swaps token and clears authExpiredEmittedAt", async () => {
      vi.useFakeTimers().setSystemTime(new Date("2026-04-11T12:00:00.000Z"));

      try {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = TOKEN;

        const initExp = new Date("2026-04-11T12:05:00.000Z");
        (ctx.aegis.verify as Mock).mockResolvedValueOnce({
          claims: { subject: "alice", expiresAt: initExp },
          header: {},
          token: TOKEN,
        });

        const mw = useAccessToken();
        await mw(ctx, next);

        (ctx.aegis.verify as Mock).mockResolvedValueOnce({
          claims: {
            subject: "alice",
            expiresAt: new Date("2026-04-11T23:59:59.000Z"),
          },
          header: {},
          token: "new-jwt",
        });

        ctx.io.socket.data.pylon.auth.authExpiredEmittedAt = new Date();

        await ctx.io.socket.data.pylon.auth.refresh({
          bearer: "new-jwt",
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
        claims: { subject: "alice", expiresAt: new Date() },
        header: {},
        token: TOKEN,
      });

      const mw = useAccessToken();
      await mw(ctx, next);

      (ctx.aegis.verify as Mock).mockResolvedValueOnce({
        claims: { subject: "bob", expiresAt: new Date() },
        header: {},
        token: "swap",
      });

      await expect(
        ctx.io.socket.data.pylon.auth.refresh({ bearer: "swap", expiresIn: 3600 }),
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
        claims: { subject: "alice", expiresAt: session.expiresAt },
        format: "jwt",
        token: "session-jwt",
      });

      const mw = useAccessToken();
      await mw(ctx, next);

      expect(ctx.io.socket.data.pylon.auth.strategy).toBe("session");
      expect(ctx.io.socket.data.pylon.auth.getExpiresAt()).toEqual(session.expiresAt);
      expect(ctx.io.socket.data.tokens.bearer).toMatchSnapshot();
      expect(next).toHaveBeenCalledTimes(1);
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

      const mw = useAccessToken();
      await mw(ctx, next);

      expect(ctx.io.socket.data.pylon.auth).toBe(preAuth);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("session refresh handler updates state from re-read session", async () => {
      const ctx = makeCtx({ data: { session } });
      (ctx.aegis.verify as Mock).mockResolvedValue({
        claims: { subject: "alice", expiresAt: session.expiresAt },
        format: "jwt",
        token: "session-jwt",
      });

      const mw = useAccessToken();
      await mw(ctx, next);

      ctx.io.socket.data.pylon.auth.authExpiredEmittedAt = new Date();
      await ctx.io.socket.data.pylon.auth.refresh({});

      expect(ctx.io.socket.data.pylon.auth.authExpiredEmittedAt).toBeNull();
    });

    test("session refresh handler throws when the session is gone (lookup null)", async () => {
      // We exercise the session-lookup-null scenario directly on
      // createSessionRefreshHandler in its own test; here we assert the
      // middleware-installed handler is callable with a now-valid session.
      const pastSession = {
        ...session,
        expiresAt: new Date("2000-01-01T00:00:00.000Z"),
      };
      const ctx = makeCtx({ data: { session: pastSession } });
      (ctx.aegis.verify as Mock).mockResolvedValue({
        claims: { subject: "alice", expiresAt: pastSession.expiresAt },
        format: "jwt",
        token: "session-jwt",
      });

      const mw = useAccessToken();
      await mw(ctx, next);

      await expect(ctx.io.socket.data.pylon.auth.refresh({})).rejects.toThrow(
        ClientError,
      );
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
      claims: {
        subject: "alice",
        expiresAt: new Date("2099-04-11T12:05:00.000Z"),
        confirmation: { thumbprint: client.jkt },
        ...overrides.claims,
      },
      custom: {},
      header: { tokenType: "access_token" },
      token: TOKEN,
    });

    const unboundVerifyResult = () => ({
      claims: { subject: "alice", expiresAt: new Date("2099-04-11T12:05:00.000Z") },
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

        const mw = useAccessToken({ dpop: "required" });
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

        const mw = useAccessToken({ dpop: "required" });
        await expect(mw(ctx, next)).rejects.toMatchObject({
          code: "handshake_dpop_binding_missing",
        });
      });

      test("accepts jkt-bound token + valid proof, strategy = dpop-bearer", async () => {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = TOKEN;
        ctx.io.socket.handshake.headers.dpop = await proofFor();
        (ctx.aegis.verify as Mock).mockResolvedValue(boundVerifyResult());

        const mw = useAccessToken({ dpop: "required" });
        await mw(ctx, next);

        // ⚠ The proof is NOT handed to aegis any more. Pylon runs the binding
        // check itself — the same `assertDpopBinding` the HTTP arm uses — so the
        // proof is verified in ONE place for both provenances.
        expect(ctx.aegis.verify).toHaveBeenCalledWith(TOKEN, undefined, VERIFY_OPTIONS);
        expect(ctx.io.socket.data.pylon.auth.strategy).toBe("dpop-bearer");
        expect(next).toHaveBeenCalledTimes(1);
      });
    });

    describe('dpop: "optional" (default)', () => {
      test("accepts bearer-only token, strategy = bearer", async () => {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = TOKEN;
        (ctx.aegis.verify as Mock).mockResolvedValue(unboundVerifyResult());

        const mw = useAccessToken();
        await mw(ctx, next);

        expect(ctx.io.socket.data.pylon.auth.strategy).toBe("bearer");
      });

      test("accepts jkt-bound token + valid proof, strategy = dpop-bearer", async () => {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = TOKEN;
        ctx.io.socket.handshake.headers.dpop = await proofFor();
        (ctx.aegis.verify as Mock).mockResolvedValue(boundVerifyResult());

        const mw = useAccessToken();
        await mw(ctx, next);

        expect(ctx.io.socket.data.pylon.auth.strategy).toBe("dpop-bearer");
      });

      test("rejects jkt-bound token without proof (strict per token)", async () => {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = TOKEN;
        (ctx.aegis.verify as Mock).mockResolvedValue(boundVerifyResult());

        const mw = useAccessToken();
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

        const mw = useAccessToken();
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

        const mw = useAccessToken();
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

        const mw = useAccessToken();
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

        const mw = useAccessToken({ dpop: "disabled" });
        await mw(ctx, next);

        expect(ctx.io.socket.data.pylon.auth.strategy).toBe("bearer");
      });
    });

    describe("refresh handler with captured jkt", () => {
      const installDpopHandshake = async (ctx: any) => {
        ctx.io.socket.handshake.auth.bearer = TOKEN;
        ctx.io.socket.handshake.headers.dpop = await proofFor();
        (ctx.aegis.verify as Mock).mockResolvedValueOnce(boundVerifyResult());

        const mw = useAccessToken();
        await mw(ctx, next);
      };

      test("accepts refresh with same cnf.jkt", async () => {
        const ctx = makeCtx();
        await installDpopHandshake(ctx);

        (ctx.aegis.verify as Mock).mockResolvedValueOnce({
          claims: {
            subject: "alice",
            expiresAt: new Date("2099-04-11T13:00:00.000Z"),
            confirmation: { thumbprint: client.jkt },
          },
          custom: {},
          header: {},
          token: "new-jwt",
        });

        await expect(
          ctx.io.socket.data.pylon.auth.refresh({
            bearer: "new-jwt",
            expiresIn: 3600,
          }),
        ).resolves.toBeUndefined();
      });

      test("rejects refresh with a different cnf.jkt", async () => {
        const ctx = makeCtx();
        await installDpopHandshake(ctx);

        (ctx.aegis.verify as Mock).mockResolvedValueOnce({
          claims: {
            subject: "alice",
            expiresAt: new Date(),
            confirmation: { thumbprint: "jkt-xyz" },
          },
          custom: {},
          header: {},
          token: "new-jwt",
        });

        await expect(
          ctx.io.socket.data.pylon.auth.refresh({
            bearer: "new-jwt",
            expiresIn: 3600,
          }),
        ).rejects.toThrow(ClientError);
      });

      test("rejects refresh when new token has no cnf.jkt", async () => {
        const ctx = makeCtx();
        await installDpopHandshake(ctx);

        (ctx.aegis.verify as Mock).mockResolvedValueOnce({
          claims: { subject: "alice", expiresAt: new Date() },
          custom: {},
          header: {},
          token: "new-jwt",
        });

        await expect(
          ctx.io.socket.data.pylon.auth.refresh({
            bearer: "new-jwt",
            expiresIn: 3600,
          }),
        ).rejects.toThrow(ClientError);
      });
    });
  });

  describe("no credentials", () => {
    test("throws Unauthorized when neither header nor session present", async () => {
      const ctx = makeCtx();
      const mw = useAccessToken();

      await expect(mw(ctx, next)).rejects.toThrow(ClientError);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
