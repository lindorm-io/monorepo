import { Aegis } from "@lindorm/aegis";
import { createMockAegis } from "@lindorm/aegis/mocks/jest";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/jest";
import { createHandshakeTokenMiddleware } from "./create-handshake-token-middleware";

jest.mock("@lindorm/aegis", () => ({
  ...jest.requireActual("@lindorm/aegis"),
  Aegis: {
    ...jest.requireActual("@lindorm/aegis").Aegis,
    parse: jest.fn(),
  },
}));

const options: any = { issuer: "https://test.lindorm.io/" };

const makeCtx = (overrides: any = {}): any => {
  const aegis = createMockAegis();
  return {
    aegis,
    logger: createMockLogger(),
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

const makeDpopVerifyResult = (overrides: any = {}) => ({
  payload: {
    subject: "alice",
    expiresAt: new Date("2026-04-11T12:05:00.000Z"),
    confirmation: { thumbprint: "jkt-abc" },
    ...overrides.payload,
  },
  header: { tokenType: "access_token" },
  token: "jwt-token",
  dpop: {
    httpMethod: "GET",
    httpUri: "https://api.example.com/socket.io/",
    ...overrides.dpop,
  },
  ...overrides.top,
});

describe("createHandshakeTokenMiddleware", () => {
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn();
    (Aegis.parse as jest.Mock).mockReset().mockReturnValue({ payload: {} });
  });

  describe("bearer path", () => {
    test("verifies bearer and registers bearer strategy auth", async () => {
      const ctx = makeCtx();
      ctx.io.socket.handshake.auth.bearer = "jwt-token";

      const exp = new Date("2026-04-11T12:05:00.000Z");
      (ctx.aegis.verify as jest.Mock).mockResolvedValue({
        payload: { subject: "alice", expiresAt: exp },
        header: { tokenType: "access_token" },
        token: "jwt-token",
      });

      const mw = createHandshakeTokenMiddleware(options);
      await mw(ctx, next);

      expect(ctx.aegis.verify).toHaveBeenCalledWith("jwt-token", {
        tokenType: "access_token",
        ...options,
      });
      expect(ctx.io.socket.data.tokens.bearer).toMatchSnapshot();
      expect(ctx.io.socket.data.pylon.auth.strategy).toBe("bearer");
      expect(ctx.io.socket.data.pylon.auth.getExpiresAt()).toEqual(exp);
      expect(ctx.io.socket.data.pylon.auth.authExpiredEmittedAt).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("throws when bearer verification fails", async () => {
      const ctx = makeCtx();
      ctx.io.socket.handshake.auth.bearer = "bad-jwt";
      (ctx.aegis.verify as jest.Mock).mockRejectedValue(new Error("bad signature"));

      const mw = createHandshakeTokenMiddleware(options);
      await expect(mw(ctx, next)).rejects.toThrow();
    });

    test("bearer refresh handler swaps token and clears authExpiredEmittedAt", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-04-11T12:00:00.000Z"));

      try {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = "jwt-token";

        const initExp = new Date("2026-04-11T12:05:00.000Z");
        (ctx.aegis.verify as jest.Mock).mockResolvedValueOnce({
          payload: { subject: "alice", expiresAt: initExp },
          header: {},
          token: "jwt-token",
        });

        const mw = createHandshakeTokenMiddleware(options);
        await mw(ctx, next);

        (ctx.aegis.verify as jest.Mock).mockResolvedValueOnce({
          payload: {
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
        jest.useRealTimers();
      }
    });

    test("bearer refresh handler throws on subject mismatch", async () => {
      const ctx = makeCtx();
      ctx.io.socket.handshake.auth.bearer = "jwt-token";

      (ctx.aegis.verify as jest.Mock).mockResolvedValueOnce({
        payload: { subject: "alice", expiresAt: new Date() },
        header: {},
        token: "jwt-token",
      });

      const mw = createHandshakeTokenMiddleware(options);
      await mw(ctx, next);

      (ctx.aegis.verify as jest.Mock).mockResolvedValueOnce({
        payload: { subject: "bob", expiresAt: new Date() },
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
      (ctx.aegis.verify as jest.Mock).mockResolvedValue({
        payload: { subject: "alice", expiresAt: session.expiresAt },
        header: { baseFormat: "JWT" },
        token: "session-jwt",
      });

      const mw = createHandshakeTokenMiddleware(options);
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
        refresh: jest.fn(async () => {}),
        authExpiredEmittedAt: null,
      };

      const ctx = makeCtx({
        data: { session, pylon: { auth: preAuth } },
      });

      const mw = createHandshakeTokenMiddleware(options);
      await mw(ctx, next);

      expect(ctx.io.socket.data.pylon.auth).toBe(preAuth);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("session refresh handler updates state from re-read session", async () => {
      const ctx = makeCtx({ data: { session } });
      (ctx.aegis.verify as jest.Mock).mockResolvedValue({
        payload: { subject: "alice", expiresAt: session.expiresAt },
        header: { baseFormat: "JWT" },
        token: "session-jwt",
      });

      const mw = createHandshakeTokenMiddleware(options);
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
      (ctx.aegis.verify as jest.Mock).mockResolvedValue({
        payload: { subject: "alice", expiresAt: pastSession.expiresAt },
        header: { baseFormat: "JWT" },
        token: "session-jwt",
      });

      const mw = createHandshakeTokenMiddleware(options);
      await mw(ctx, next);

      await expect(ctx.io.socket.data.pylon.auth.refresh({})).rejects.toThrow(
        ClientError,
      );
    });
  });

  describe("DPoP path", () => {
    const mockPreflightJkt = (jkt = "jkt-abc") => {
      (Aegis.parse as jest.Mock).mockReturnValue({
        payload: { confirmation: { thumbprint: jkt } },
      });
    };

    describe('dpop: "required"', () => {
      test("rejects when DPoP header is missing", async () => {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = "jwt-token";

        const mw = createHandshakeTokenMiddleware({ ...options, dpop: "required" });
        await expect(mw(ctx, next)).rejects.toThrow(ClientError);
        expect(ctx.aegis.verify).not.toHaveBeenCalled();
      });

      test("rejects when bearer-only token (no cnf.jkt) is presented", async () => {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = "jwt-token";
        ctx.io.socket.handshake.headers.dpop = "proof-jwt";
        (ctx.aegis.verify as jest.Mock).mockResolvedValue({
          payload: { subject: "alice", expiresAt: new Date() },
          header: {},
          token: "jwt-token",
          dpop: {
            httpMethod: "GET",
            httpUri: "https://api.example.com/socket.io/",
          },
        });

        const mw = createHandshakeTokenMiddleware({ ...options, dpop: "required" });
        await expect(mw(ctx, next)).rejects.toThrow(ClientError);
      });

      test("accepts jkt-bound token + valid proof, strategy = dpop-bearer", async () => {
        mockPreflightJkt();
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = "jwt-token";
        ctx.io.socket.handshake.headers.dpop = "proof-jwt";
        (ctx.aegis.verify as jest.Mock).mockResolvedValue(makeDpopVerifyResult());

        const mw = createHandshakeTokenMiddleware({ ...options, dpop: "required" });
        await mw(ctx, next);

        expect(ctx.aegis.verify).toHaveBeenCalledWith("jwt-token", {
          tokenType: "access_token",
          ...options,
          dpopProof: "proof-jwt",
        });
        expect(ctx.io.socket.data.pylon.auth.strategy).toBe("dpop-bearer");
        expect(next).toHaveBeenCalledTimes(1);
      });
    });

    describe('dpop: "optional" (default)', () => {
      test("accepts bearer-only token, strategy = bearer", async () => {
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = "jwt-token";
        (ctx.aegis.verify as jest.Mock).mockResolvedValue({
          payload: { subject: "alice", expiresAt: new Date() },
          header: {},
          token: "jwt-token",
        });

        const mw = createHandshakeTokenMiddleware(options);
        await mw(ctx, next);

        expect(ctx.io.socket.data.pylon.auth.strategy).toBe("bearer");
      });

      test("accepts jkt-bound token + valid proof, strategy = dpop-bearer", async () => {
        mockPreflightJkt();
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = "jwt-token";
        ctx.io.socket.handshake.headers.dpop = "proof-jwt";
        (ctx.aegis.verify as jest.Mock).mockResolvedValue(makeDpopVerifyResult());

        const mw = createHandshakeTokenMiddleware(options);
        await mw(ctx, next);

        expect(ctx.io.socket.data.pylon.auth.strategy).toBe("dpop-bearer");
      });

      test("rejects jkt-bound token without proof (strict per token)", async () => {
        mockPreflightJkt();
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = "jwt-token";
        (ctx.aegis.verify as jest.Mock).mockResolvedValue({
          payload: {
            subject: "alice",
            expiresAt: new Date(),
            confirmation: { thumbprint: "jkt-abc" },
          },
          header: {},
          token: "jwt-token",
        });

        const mw = createHandshakeTokenMiddleware(options);
        await expect(mw(ctx, next)).rejects.toThrow(ClientError);
      });

      test("rejects invalid DPoP proof (htu mismatch)", async () => {
        mockPreflightJkt();
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = "jwt-token";
        ctx.io.socket.handshake.headers.dpop = "proof-jwt";
        (ctx.aegis.verify as jest.Mock).mockResolvedValue(
          makeDpopVerifyResult({
            dpop: {
              httpMethod: "GET",
              httpUri: "https://evil.example.com/socket.io/",
            },
          }),
        );

        const mw = createHandshakeTokenMiddleware(options);
        await expect(mw(ctx, next)).rejects.toThrow(ClientError);
      });
    });

    describe('dpop: "disabled"', () => {
      test("accepts jkt-bound token without proof as plain bearer", async () => {
        mockPreflightJkt();
        const ctx = makeCtx();
        ctx.io.socket.handshake.auth.bearer = "jwt-token";
        (ctx.aegis.verify as jest.Mock).mockResolvedValue({
          payload: {
            subject: "alice",
            expiresAt: new Date(),
            confirmation: { thumbprint: "jkt-abc" },
          },
          header: {},
          token: "jwt-token",
        });

        const mw = createHandshakeTokenMiddleware({ ...options, dpop: "disabled" });
        await mw(ctx, next);

        expect(ctx.io.socket.data.pylon.auth.strategy).toBe("bearer");
      });
    });

    describe("refresh handler with captured jkt", () => {
      const installDpopHandshake = async (ctx: any) => {
        mockPreflightJkt();
        ctx.io.socket.handshake.auth.bearer = "jwt-token";
        ctx.io.socket.handshake.headers.dpop = "proof-jwt";
        (ctx.aegis.verify as jest.Mock).mockResolvedValueOnce(makeDpopVerifyResult());

        const mw = createHandshakeTokenMiddleware(options);
        await mw(ctx, next);
      };

      test("accepts refresh with same cnf.jkt", async () => {
        const ctx = makeCtx();
        await installDpopHandshake(ctx);

        (ctx.aegis.verify as jest.Mock).mockResolvedValueOnce({
          payload: {
            subject: "alice",
            expiresAt: new Date("2026-04-11T13:00:00.000Z"),
            confirmation: { thumbprint: "jkt-abc" },
          },
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

        (ctx.aegis.verify as jest.Mock).mockResolvedValueOnce({
          payload: {
            subject: "alice",
            expiresAt: new Date(),
            confirmation: { thumbprint: "jkt-xyz" },
          },
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

        (ctx.aegis.verify as jest.Mock).mockResolvedValueOnce({
          payload: { subject: "alice", expiresAt: new Date() },
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
      const mw = createHandshakeTokenMiddleware(options);

      await expect(mw(ctx, next)).rejects.toThrow(ClientError);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
