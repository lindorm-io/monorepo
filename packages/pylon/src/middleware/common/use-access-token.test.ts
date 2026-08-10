import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { ClientError, ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { OPAQUE_TOKEN, joseShapedToken } from "../../__fixtures__/access/tokens.js";
import { useAccessToken } from "./use-access-token.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../__fixtures__/app-config.js";

/** Auth configured with a driver that CAN introspect — the ordinary resource
 *  server, so the opaque arm is reachable. */
const APP_CONFIG = createTestAppConfig({ auth: createTestAuthConfig() });

describe("useAccessToken", () => {
  let next: Mock;

  beforeEach(() => {
    next = vi.fn();
  });

  describe("HTTP context", () => {
    let ctx: any;

    beforeEach(() => {
      ctx = {
        aegis: createMockAegis(),
        auth: { introspect: vi.fn() },
        logger: createMockLogger(),
        request: {},
        state: {
          access: null,
          app: { config: APP_CONFIG },
          authorization: { type: "bearer", value: joseShapedToken() },
          session: null,
          tokens: {},
        },
      };
    });

    test("verifies a JOSE bearer token and resolves verified access", async () => {
      const middleware = useAccessToken();

      await expect(middleware(ctx, next)).resolves.toBeUndefined();

      // ⚠ `assert` is `undefined`. The claim matchers — including the ISSUER —
      // are no longer handed to verify: they run once, afterwards, over the
      // resolved claims of whichever arm produced them, which is what makes a
      // mount's matchers apply to an opaque credential too.
      expect(ctx.aegis.verify).toHaveBeenCalledWith(
        joseShapedToken(),
        undefined,
        // pylon owns the DPoP binding check now, so aegis is told to trust the
        // bound thumbprint rather than demand a proof it was never handed.
        { tokenType: "access_token", trustBoundThumbprint: true },
      );
      expect(ctx.auth.introspect).not.toHaveBeenCalled();
      expect(ctx.state.tokens.accessToken).toMatchSnapshot();
      expect(ctx.state.access).toMatchSnapshot();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("introspects an OPAQUE bearer token and resolves introspected access", async () => {
      ctx.state.authorization = { type: "bearer", value: OPAQUE_TOKEN };
      ctx.auth.introspect.mockResolvedValue({
        active: true,
        custom: {},
        subject: "alice",
        scope: ["openid"],
        permissions: ["users:read"],
      });

      const middleware = useAccessToken();

      await expect(middleware(ctx, next)).resolves.toBeUndefined();

      expect(ctx.aegis.verify).not.toHaveBeenCalled();
      expect(ctx.auth.introspect).toHaveBeenCalledWith(OPAQUE_TOKEN, {
        cache: undefined,
      });
      // No VerifiedToken exists on this path — never synthesise one.
      expect(ctx.state.tokens.accessToken).toBeUndefined();
      expect(ctx.state.access).toMatchSnapshot();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("both provenances resolve the same claim shape", async () => {
      const claims = { subject: "alice", scope: ["openid"], permissions: ["users:read"] };

      (ctx.aegis.verify as Mock).mockResolvedValue({
        claims,
        custom: {},
        format: "jwt",
        header: {},
        token: joseShapedToken(),
      });
      await useAccessToken()(ctx, next);
      const verified = ctx.state.access;

      ctx.state.access = null;
      ctx.state.tokens = {};
      ctx.state.authorization = { type: "bearer", value: OPAQUE_TOKEN };
      ctx.auth.introspect.mockResolvedValue({ active: true, custom: {}, ...claims });
      await useAccessToken()(ctx, next);
      const introspected = ctx.state.access;

      expect(verified.provenance).toBe("verified");
      expect(introspected.provenance).toBe("introspected");
      expect(introspected.claims).toEqual(verified.claims);
    });

    test("throws 401 when introspection reports the token is not active", async () => {
      ctx.state.authorization = { type: "bearer", value: OPAQUE_TOKEN };
      ctx.auth.introspect.mockResolvedValue({ active: false });

      const middleware = useAccessToken();

      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);

      try {
        await middleware(ctx, next);
        expect.fail("Expected error to be thrown");
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.code).toBe("token_not_active");
      }
      expect(ctx.state.access).toBeNull();
      expect(next).not.toHaveBeenCalled();
    });

    test("falls back to session.accessToken when no header present", async () => {
      ctx.state.authorization = { type: "none", value: null };
      ctx.state.session = {
        id: "sess-1",
        accessToken: "session-jwt",
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        issuedAt: new Date(),
        scope: ["openid"],
        subject: "alice",
      };
      (ctx.aegis.verify as Mock).mockResolvedValue({
        claims: { subject: "alice" },
        custom: {},
        format: "jwt",
        token: "session-jwt",
      });

      const middleware = useAccessToken();
      await middleware(ctx, next);

      expect(ctx.aegis.verify).toHaveBeenCalledWith("session-jwt");
      expect(ctx.state.tokens.accessToken).toMatchSnapshot();
      expect(ctx.state.access).toMatchSnapshot();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("prefers header over session when both present", async () => {
      ctx.state.session = {
        id: "sess-1",
        accessToken: "session-jwt",
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        issuedAt: new Date(),
        scope: ["openid"],
        subject: "alice",
      };

      const middleware = useAccessToken();
      await middleware(ctx, next);

      expect(ctx.aegis.verify).toHaveBeenCalledWith(
        joseShapedToken(),
        undefined,
        expect.objectContaining({ tokenType: "access_token" }),
      );
    });

    test("throws Unauthorized when neither header nor session present", async () => {
      ctx.state.authorization = { type: "none", value: null };

      const middleware = useAccessToken();
      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);
    });

    test("throws Unauthorized when session accessToken cannot be parsed", async () => {
      ctx.state.authorization = { type: "none", value: null };
      ctx.state.session = {
        id: "sess-1",
        accessToken: "bad",
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        issuedAt: new Date(),
        scope: ["openid"],
        subject: "alice",
      };
      const { AegisError } =
        await vi.importActual<typeof import("@lindorm/aegis")>("@lindorm/aegis");
      (ctx.aegis.verify as Mock).mockRejectedValue(new AegisError("bad token"));

      const middleware = useAccessToken();
      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);
    });
  });

  describe("Socket event fast path", () => {
    const makeCtx = (authOverride: any = {}): any => {
      const parsedBearer = {
        claims: { subject: "alice" },
        custom: {},
        format: "jwt",
        token: "socket-jwt",
      };
      // What the handshake arm leaves behind. The fast path republishes THIS
      // rather than rebuilding an access shape from the parsed token, because an
      // opaque credential produces no parsed token at all.
      const handshakeAccess = {
        provenance: "verified" as const,
        claims: parsedBearer.claims,
        custom: parsedBearer.custom,
        token: parsedBearer.token,
      };
      return {
        aegis: createMockAegis(),
        auth: { introspect: vi.fn() },
        logger: createMockLogger(),
        event: "some:event",
        state: { access: null, app: { config: APP_CONFIG }, tokens: {} },
        io: {
          socket: {
            data: {
              tokens: { bearer: parsedBearer },
              pylon: {
                access: handshakeAccess,
                auth: {
                  strategy: "bearer",
                  getExpiresAt: () => new Date("2099-01-01T00:00:00.000Z"),
                  refresh: async () => {},
                  authExpiredEmittedAt: null,
                  ...authOverride,
                },
              },
            },
            emit: vi.fn(),
          },
        },
      };
    };

    test("accepts silently when well before expiry warning window", async () => {
      const ctx = makeCtx();
      const middleware = useAccessToken();

      await middleware(ctx, next);

      expect(ctx.io.socket.emit).not.toHaveBeenCalled();
      expect(ctx.aegis.verify).not.toHaveBeenCalled();
      expect(ctx.state.tokens.accessToken).toBe(ctx.io.socket.data.tokens.bearer);
      expect(ctx.state.access).toMatchSnapshot();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("emits $pylon/auth/expired exactly once inside the warning window", async () => {
      const soon = new Date(Date.now() + 30_000);
      const ctx = makeCtx({ getExpiresAt: () => soon });
      const middleware = useAccessToken();

      await middleware(ctx, next);

      expect(ctx.io.socket.emit).toHaveBeenCalledWith("$pylon/auth/expired", {
        expiresAt: soon,
      });
      expect(ctx.io.socket.data.pylon.auth.authExpiredEmittedAt).not.toBeNull();

      ctx.io.socket.emit.mockClear();
      await middleware(ctx, next);

      expect(ctx.io.socket.emit).not.toHaveBeenCalled();
    });

    test("throws hard when now >= expiresAt", async () => {
      const past = new Date(Date.now() - 1_000);
      const ctx = makeCtx({ getExpiresAt: () => past });
      const middleware = useAccessToken();

      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);
      expect(ctx.io.socket.emit).not.toHaveBeenCalled();
    });

    // The fast path returns `expiresAt`/`strategy` to the dispatch site so the
    // socket arm logs through the SAME timer the http arm uses. Assert the
    // round-trip, or a wrong/dropped value would pass every other test here.
    test("logs the accepted fast path with expiresAt and strategy", async () => {
      const expiresAt = new Date("2099-01-01T00:00:00.000Z");
      const ctx = makeCtx({ strategy: "dpop-bearer", getExpiresAt: () => expiresAt });
      const middleware = useAccessToken();

      await middleware(ctx, next);

      const timer = (ctx.logger.timer as Mock).mock.results[0].value;
      expect(timer.debug).toHaveBeenCalledWith("Access token fast-path accepted", {
        expiresAt,
        strategy: "dpop-bearer",
      });
    });

    test("throws Unauthorized when socket.data.pylon.auth is missing", async () => {
      const ctx = makeCtx();
      ctx.io.socket.data.pylon = {};

      const middleware = useAccessToken();
      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);
    });
  });

  // The handshake phase used to be REFUSED here (`createAccessTokenMiddleware`
  // threw `access_token_middleware_in_handshake` and pointed at a second
  // factory). One mount now serves it — the exhaustive handshake coverage lives
  // in use-access-token.handshake.test.ts; this pins the DISPATCH.
  describe("handshake context", () => {
    test("runs the handshake arm instead of refusing it", async () => {
      const ctx: any = {
        aegis: createMockAegis(),
        auth: { introspect: vi.fn() },
        logger: createMockLogger(),
        handshakeId: "abc",
        io: {
          socket: {
            handshake: { auth: { bearer: joseShapedToken() }, headers: {} },
            data: { tokens: {}, pylon: {} },
          },
        },
        state: { access: null, app: { config: APP_CONFIG }, tokens: {} },
      };
      (ctx.aegis.verify as Mock).mockResolvedValue({
        claims: { subject: "alice", expiresAt: new Date("2099-01-01T00:00:00.000Z") },
        custom: {},
        header: { tokenType: "access_token" },
        token: joseShapedToken(),
      });

      await expect(useAccessToken()(ctx, next)).resolves.toBeUndefined();

      expect(ctx.aegis.verify).toHaveBeenCalledWith(joseShapedToken(), undefined, {
        tokenType: "access_token",
        trustBoundThumbprint: true,
      });
      expect(ctx.io.socket.data.pylon.auth.strategy).toBe("bearer");
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // No mount states an issuer, so a deployment that resolved none has nothing to
  // verify against. Refuse by name rather than verify with no `issuer` matcher —
  // that is not a weaker check, it is NO check.
  describe("unresolved issuer", () => {
    const makeCtx = (auth: any): any => ({
      aegis: createMockAegis(),
      auth: { introspect: vi.fn() },
      logger: createMockLogger(),
      request: {},
      state: {
        access: null,
        app: { config: createTestAppConfig({ auth }) },
        authorization: { type: "bearer", value: joseShapedToken() },
        session: null,
        tokens: {},
      },
    });

    test("throws ServerError when the deployment configured no auth block", async () => {
      const ctx = makeCtx(null);

      await expect(useAccessToken()(ctx, next)).rejects.toMatchObject({
        code: "access_issuer_unresolved",
        type: "urn:lindorm:pylon:error:access_issuer_unresolved",
        data: { auth: "unconfigured" },
      });
      expect(ctx.aegis.verify).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test("throws ServerError when the driver could not settle an issuer", async () => {
      const ctx = makeCtx(createTestAuthConfig({ issuer: null }));

      await expect(useAccessToken()(ctx, next)).rejects.toThrow(ServerError);
      await expect(useAccessToken()(ctx, next)).rejects.toMatchObject({
        data: { auth: "unresolved" },
      });
      expect(ctx.aegis.verify).not.toHaveBeenCalled();
    });

    // The OPAQUE arm never verifies locally, so it must not demand an issuer:
    // RFC 7662 makes the authorization server the authority on that credential.
    test("still introspects an opaque token with no issuer resolved", async () => {
      const ctx = makeCtx(createTestAuthConfig({ issuer: null }));
      ctx.state.authorization = { type: "bearer", value: OPAQUE_TOKEN };
      ctx.auth.introspect.mockResolvedValue({
        active: true,
        custom: {},
        subject: "alice",
      });

      await expect(useAccessToken()(ctx, next)).resolves.toBeUndefined();

      expect(ctx.state.access.provenance).toBe("introspected");
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("common", () => {
    test("throws 401 when verification fails", async () => {
      const ctx: any = {
        aegis: createMockAegis(),
        auth: { introspect: vi.fn() },
        logger: createMockLogger(),
        request: {},
        state: {
          access: null,
          app: { config: APP_CONFIG },
          authorization: { type: "bearer", value: joseShapedToken() },
          session: null,
          tokens: {},
        },
      };

      (ctx.aegis.verify as Mock).mockRejectedValue(new Error("invalid signature"));

      const middleware = useAccessToken();
      await expect(middleware(ctx, next)).rejects.toMatchObject({
        status: 401,
        code: "access_token_verification_failed",
      });
      expect(ctx.state.access).toBeNull();
    });
  });
});
