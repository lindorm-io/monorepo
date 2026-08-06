import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { ClientError, ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { OPAQUE_TOKEN, joseShapedToken } from "../../__fixtures__/access/tokens.js";
import { createAccessTokenMiddleware } from "./create-access-token-middleware.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

describe("createAccessTokenMiddleware", () => {
  let next: Mock;

  const options: any = { issuer: "https://test.lindorm.io/" };

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
          authorization: { type: "bearer", value: joseShapedToken() },
          session: null,
          tokens: {},
        },
      };
    });

    test("verifies a JOSE bearer token and resolves verified access", async () => {
      const middleware = createAccessTokenMiddleware(options);

      await expect(middleware(ctx, next)).resolves.toBeUndefined();

      expect(ctx.aegis.verify).toHaveBeenCalledWith(
        joseShapedToken(),
        { ...options },
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
        subject: "alice",
        scope: ["openid"],
        permissions: ["users:read"],
      });

      const middleware = createAccessTokenMiddleware(options);

      await expect(middleware(ctx, next)).resolves.toBeUndefined();

      expect(ctx.aegis.verify).not.toHaveBeenCalled();
      expect(ctx.auth.introspect).toHaveBeenCalledWith(OPAQUE_TOKEN);
      // No VerifiedToken exists on this path — never synthesise one.
      expect(ctx.state.tokens.accessToken).toBeUndefined();
      expect(ctx.state.access).toMatchSnapshot();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("both provenances resolve the same claim shape", async () => {
      const claims = { subject: "alice", scope: ["openid"], permissions: ["users:read"] };

      (ctx.aegis.verify as Mock).mockResolvedValue({
        claims,
        format: "jwt",
        header: {},
        token: joseShapedToken(),
      });
      await createAccessTokenMiddleware(options)(ctx, next);
      const verified = ctx.state.access;

      ctx.state.access = null;
      ctx.state.tokens = {};
      ctx.state.authorization = { type: "bearer", value: OPAQUE_TOKEN };
      ctx.auth.introspect.mockResolvedValue({ active: true, ...claims });
      await createAccessTokenMiddleware(options)(ctx, next);
      const introspected = ctx.state.access;

      expect(verified.provenance).toBe("verified");
      expect(introspected.provenance).toBe("introspected");
      expect(introspected.claims).toEqual(verified.claims);
    });

    test("throws 401 when introspection reports the token is not active", async () => {
      ctx.state.authorization = { type: "bearer", value: OPAQUE_TOKEN };
      ctx.auth.introspect.mockResolvedValue({ active: false });

      const middleware = createAccessTokenMiddleware(options);

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
        format: "jwt",
        token: "session-jwt",
      });

      const middleware = createAccessTokenMiddleware(options);
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

      const middleware = createAccessTokenMiddleware(options);
      await middleware(ctx, next);

      expect(ctx.aegis.verify).toHaveBeenCalledWith(
        joseShapedToken(),
        { ...options },
        expect.objectContaining({ tokenType: "access_token" }),
      );
    });

    test("throws Unauthorized when neither header nor session present", async () => {
      ctx.state.authorization = { type: "none", value: null };

      const middleware = createAccessTokenMiddleware(options);
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

      const middleware = createAccessTokenMiddleware(options);
      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);
    });
  });

  describe("Socket event fast path", () => {
    const makeCtx = (authOverride: any = {}): any => {
      const parsedBearer = {
        claims: { subject: "alice" },
        format: "jwt",
        token: "socket-jwt",
      };
      return {
        aegis: createMockAegis(),
        auth: { introspect: vi.fn() },
        logger: createMockLogger(),
        event: "some:event",
        state: { access: null, tokens: {} },
        io: {
          socket: {
            data: {
              tokens: { bearer: parsedBearer },
              pylon: {
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
      const middleware = createAccessTokenMiddleware(options);

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
      const middleware = createAccessTokenMiddleware(options);

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
      const middleware = createAccessTokenMiddleware(options);

      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);
      expect(ctx.io.socket.emit).not.toHaveBeenCalled();
    });

    test("throws Unauthorized when socket.data.pylon.auth is missing", async () => {
      const ctx = makeCtx();
      ctx.io.socket.data.pylon = {};

      const middleware = createAccessTokenMiddleware(options);
      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);
    });
  });

  describe("handshake context guard", () => {
    test("throws ServerError if run in the handshake phase", async () => {
      const ctx: any = {
        aegis: createMockAegis(),
        auth: { introspect: vi.fn() },
        logger: createMockLogger(),
        handshakeId: "abc",
        io: { socket: { handshake: {}, data: {} } },
        state: { access: null, tokens: {} },
      };
      const middleware = createAccessTokenMiddleware(options);
      await expect(middleware(ctx, next)).rejects.toThrow(ServerError);
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
          authorization: { type: "bearer", value: joseShapedToken() },
          session: null,
          tokens: {},
        },
      };

      (ctx.aegis.verify as Mock).mockRejectedValue(new Error("invalid signature"));

      const middleware = createAccessTokenMiddleware(options);
      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);
      expect(ctx.state.access).toBeNull();
    });
  });
});
