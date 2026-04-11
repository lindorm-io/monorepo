import { Aegis, createMockAegis } from "@lindorm/aegis";
import { ClientError, ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
import { createAccessTokenMiddleware } from "./create-access-token-middleware";

jest.mock("@lindorm/aegis", () => ({
  ...jest.requireActual("@lindorm/aegis"),
  Aegis: {
    ...jest.requireActual("@lindorm/aegis").Aegis,
    parse: jest.fn(),
  },
}));

describe("createAccessTokenMiddleware", () => {
  let next: jest.Mock;

  const options: any = { issuer: "https://test.lindorm.io/" };

  beforeEach(() => {
    next = jest.fn();
    (Aegis.parse as jest.Mock).mockReset();
  });

  describe("HTTP context", () => {
    let ctx: any;

    beforeEach(() => {
      ctx = {
        aegis: createMockAegis(),
        logger: createMockLogger(),
        request: {},
        state: {
          authorization: { type: "bearer", value: "jwt-token" },
          session: null,
          tokens: {},
        },
      };
    });

    test("verifies bearer header and stores on ctx.state.tokens.accessToken", async () => {
      const middleware = createAccessTokenMiddleware(options);

      await expect(middleware(ctx, next)).resolves.toBeUndefined();

      expect(ctx.aegis.verify).toHaveBeenCalledWith("jwt-token", {
        tokenType: "access_token",
        ...options,
        dpopProof: undefined,
      });
      expect(ctx.state.tokens.accessToken).toMatchSnapshot();
      expect(next).toHaveBeenCalledTimes(1);
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
      (Aegis.parse as jest.Mock).mockReturnValue({
        payload: { subject: "alice" },
        header: {},
        token: "session-jwt",
      });

      const middleware = createAccessTokenMiddleware(options);
      await middleware(ctx, next);

      expect(ctx.aegis.verify).not.toHaveBeenCalled();
      expect(ctx.state.tokens.accessToken).toMatchSnapshot();
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
        "jwt-token",
        expect.objectContaining({ tokenType: "access_token" }),
      );
      expect(Aegis.parse).not.toHaveBeenCalled();
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
      (Aegis.parse as jest.Mock).mockImplementation(() => {
        throw new Error("bad");
      });

      const middleware = createAccessTokenMiddleware(options);
      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);
    });
  });

  describe("DPoP (HTTP)", () => {
    let ctx: any;

    beforeEach(() => {
      ctx = {
        aegis: createMockAegis(),
        logger: createMockLogger(),
        method: "POST",
        origin: "https://api.example.com",
        path: "/orders",
        request: {},
        get: jest.fn((header: string) =>
          header.toLowerCase() === "dpop" ? "proof-jwt" : undefined,
        ),
        state: {
          authorization: { type: "dpop", value: "jwt-token" },
          session: null,
          tokens: {},
        },
      };

      (ctx.aegis.verify as jest.Mock).mockResolvedValue({
        header: { tokenType: "access_token" },
        payload: {
          subject: "verified_subject",
          confirmation: { thumbprint: "proof-thumbprint" },
        },
        dpop: {
          thumbprint: "proof-thumbprint",
          tokenId: "proof-jti",
          httpMethod: "POST",
          httpUri: "https://api.example.com/orders",
          issuedAt: new Date("2024-01-01T08:00:00.000Z"),
        },
      });
    });

    test("passes DPoP header to aegis and stores verified token", async () => {
      const middleware = createAccessTokenMiddleware(options);
      await middleware(ctx, next);

      expect(ctx.aegis.verify).toHaveBeenCalledWith("jwt-token", {
        tokenType: "access_token",
        ...options,
        dpopProof: "proof-jwt",
      });
      expect(ctx.state.tokens.accessToken).toMatchSnapshot();
    });

    test("throws 401 when DPoP header missing", async () => {
      ctx.get.mockReturnValue(undefined);
      const middleware = createAccessTokenMiddleware(options);
      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);
    });

    test("throws 401 when proof htm does not match request method", async () => {
      ctx.method = "GET";
      const middleware = createAccessTokenMiddleware(options);
      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);
    });

    test("throws 401 when proof htu does not match request URI", async () => {
      ctx.path = "/other-path";
      const middleware = createAccessTokenMiddleware(options);
      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);
    });
  });

  describe("Socket event fast path", () => {
    const makeCtx = (authOverride: any = {}): any => {
      const parsedBearer = { payload: { subject: "alice" }, header: {}, token: "x" };
      return {
        aegis: createMockAegis(),
        logger: createMockLogger(),
        event: "some:event",
        state: { tokens: {} },
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
            emit: jest.fn(),
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
        logger: createMockLogger(),
        handshakeId: "abc",
        io: { socket: { handshake: {}, data: {} } },
        state: { tokens: {} },
      };
      const middleware = createAccessTokenMiddleware(options);
      await expect(middleware(ctx, next)).rejects.toThrow(ServerError);
    });
  });

  describe("common", () => {
    test("throws 401 when verification fails", async () => {
      const ctx: any = {
        aegis: createMockAegis(),
        logger: createMockLogger(),
        request: {},
        state: {
          authorization: { type: "bearer", value: "jwt-token" },
          session: null,
          tokens: {},
        },
      };

      (ctx.aegis.verify as jest.Mock).mockRejectedValue(new Error("invalid signature"));

      const middleware = createAccessTokenMiddleware(options);
      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);
    });
  });
});
