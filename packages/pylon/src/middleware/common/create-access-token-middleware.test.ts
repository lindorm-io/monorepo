import { createMockAegis } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
import { createAccessTokenMiddleware } from "./create-access-token-middleware";

describe("createAccessTokenMiddleware", () => {
  let next: jest.Mock;

  const options: any = { issuer: "https://test.lindorm.io/" };

  beforeEach(() => {
    next = jest.fn();
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
          tokens: {},
        },
      };
    });

    test("should verify and store on ctx.state.tokens.accessToken", async () => {
      const middleware = createAccessTokenMiddleware(options);

      await expect(middleware(ctx, next)).resolves.toBeUndefined();

      expect(ctx.aegis.verify).toHaveBeenCalledWith("jwt-token", {
        tokenType: "access_token",
        ...options,
      });
      expect(ctx.state.tokens.accessToken).toMatchSnapshot();
    });

    test("should throw 401 when authorization type is not bearer", async () => {
      ctx.state.authorization.type = "basic";

      const middleware = createAccessTokenMiddleware(options);

      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);

      try {
        await middleware(ctx, next);
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.message).toMatchSnapshot();
      }
    });

    test("should call next", async () => {
      const middleware = createAccessTokenMiddleware(options);

      await middleware(ctx, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("Socket context", () => {
    let ctx: any;

    beforeEach(() => {
      ctx = {
        aegis: createMockAegis(),
        event: "test:event",
        logger: createMockLogger(),
        state: {
          authorization: { type: "none", value: "" },
          tokens: {},
        },
        io: {
          socket: {
            handshake: { auth: { bearer: "jwt-token" } },
            data: { tokens: {} },
          },
        },
      };
    });

    test("should verify and store on both ctx.state.tokens.accessToken and ctx.socket.data.tokens.bearer", async () => {
      const middleware = createAccessTokenMiddleware(options);

      await expect(middleware(ctx, next)).resolves.toBeUndefined();

      expect(ctx.aegis.verify).toHaveBeenCalledWith("jwt-token", {
        tokenType: "access_token",
        ...options,
      });
      expect(ctx.state.tokens.accessToken).toMatchSnapshot();
      expect(ctx.io.socket.data.tokens.bearer).toMatchSnapshot();
    });

    test("should throw 401 when handshake bearer is not a string", async () => {
      ctx.io.socket.handshake.auth.bearer = 12345;

      const middleware = createAccessTokenMiddleware(options);

      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);

      try {
        await middleware(ctx, next);
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.message).toMatchSnapshot();
      }
    });
  });

  describe("DPoP", () => {
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
          tokens: {},
        },
      };

      ctx.aegis.verify.mockResolvedValue({
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

    test("should pass the DPoP header to aegis and store the verified token", async () => {
      const middleware = createAccessTokenMiddleware(options);

      await expect(middleware(ctx, next)).resolves.toBeUndefined();

      expect(ctx.aegis.verify).toHaveBeenCalledWith("jwt-token", {
        tokenType: "access_token",
        ...options,
        dpopProof: "proof-jwt",
      });
      expect(ctx.state.tokens.accessToken).toMatchSnapshot();
    });

    test("should throw 401 when the DPoP header is missing", async () => {
      ctx.get.mockReturnValue(undefined);
      const middleware = createAccessTokenMiddleware(options);

      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);
    });

    test("should throw 401 when proof htm does not match request method", async () => {
      ctx.method = "GET";
      const middleware = createAccessTokenMiddleware(options);

      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);
    });

    test("should throw 401 when proof htu does not match request URI", async () => {
      ctx.path = "/other-path";
      const middleware = createAccessTokenMiddleware(options);

      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);
    });

    test("should normalize htu when comparing (default port, case)", async () => {
      ctx.origin = "HTTPS://API.EXAMPLE.COM:443";
      ctx.path = "/orders";
      const middleware = createAccessTokenMiddleware(options);

      await expect(middleware(ctx, next)).resolves.toBeUndefined();
    });
  });

  describe("common", () => {
    test("should throw 401 when verification fails", async () => {
      const ctx: any = {
        aegis: createMockAegis(),
        logger: createMockLogger(),
        request: {},
        state: {
          authorization: { type: "bearer", value: "jwt-token" },
          tokens: {},
        },
      };

      ctx.aegis.verify.mockRejectedValue(new Error("invalid signature"));

      const middleware = createAccessTokenMiddleware(options);

      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);

      try {
        await middleware(ctx, next);
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.message).toMatchSnapshot();
      }
    });
  });
});
