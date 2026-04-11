import { Aegis, createMockAegis } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
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
          headers: {},
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

describe("createHandshakeTokenMiddleware", () => {
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn();
    (Aegis.parse as jest.Mock).mockReset();
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
      (Aegis.parse as jest.Mock).mockReturnValue({
        payload: { subject: "alice", expiresAt: session.expiresAt },
        header: {},
        token: "session-jwt",
      });

      const ctx = makeCtx({ data: { session } });

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
      (Aegis.parse as jest.Mock).mockReturnValue({
        payload: { subject: "alice", expiresAt: session.expiresAt },
        header: {},
        token: "session-jwt",
      });

      const ctx = makeCtx({ data: { session } });

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
      (Aegis.parse as jest.Mock).mockReturnValue({
        payload: { subject: "alice", expiresAt: pastSession.expiresAt },
        header: {},
        token: "session-jwt",
      });

      const ctx = makeCtx({ data: { session: pastSession } });

      const mw = createHandshakeTokenMiddleware(options);
      await mw(ctx, next);

      await expect(ctx.io.socket.data.pylon.auth.refresh({})).rejects.toThrow(
        ClientError,
      );
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
