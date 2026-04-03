import { createMockAegis } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger";
import { createBearerTokenMiddleware } from "./create-bearer-token-middleware";

describe("createBearerTokenMiddleware", () => {
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
        state: {
          authorization: { type: "bearer", value: "jwt-token" },
          tokens: {},
        },
      };
    });

    test("should verify and store on ctx.state.tokens.accessToken", async () => {
      const middleware = createBearerTokenMiddleware(options);

      await expect(middleware(ctx, next)).resolves.toBeUndefined();

      expect(ctx.aegis.verify).toHaveBeenCalledWith("jwt-token", {
        tokenType: "access_token",
        ...options,
      });
      expect(ctx.state.tokens.accessToken).toMatchSnapshot();
    });

    test("should throw 401 when authorization type is not bearer", async () => {
      ctx.state.authorization.type = "basic";

      const middleware = createBearerTokenMiddleware(options);

      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);

      try {
        await middleware(ctx, next);
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.message).toMatchSnapshot();
      }
    });

    test("should call next", async () => {
      const middleware = createBearerTokenMiddleware(options);

      await middleware(ctx, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("Socket context", () => {
    let ctx: any;

    beforeEach(() => {
      ctx = {
        aegis: createMockAegis(),
        logger: createMockLogger(),
        state: {
          authorization: { type: "none", value: "" },
          tokens: {},
        },
        socket: {
          handshake: { auth: { bearer: "jwt-token" } },
          data: { tokens: {} },
        },
      };
    });

    test("should verify and store on both ctx.state.tokens.accessToken and ctx.socket.data.tokens.bearer", async () => {
      const middleware = createBearerTokenMiddleware(options);

      await expect(middleware(ctx, next)).resolves.toBeUndefined();

      expect(ctx.aegis.verify).toHaveBeenCalledWith("jwt-token", {
        tokenType: "access_token",
        ...options,
      });
      expect(ctx.state.tokens.accessToken).toMatchSnapshot();
      expect(ctx.socket.data.tokens.bearer).toMatchSnapshot();
    });

    test("should throw 401 when handshake bearer is not a string", async () => {
      ctx.socket.handshake.auth.bearer = 12345;

      const middleware = createBearerTokenMiddleware(options);

      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);

      try {
        await middleware(ctx, next);
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.message).toMatchSnapshot();
      }
    });
  });

  describe("common", () => {
    test("should throw 401 when verification fails", async () => {
      const ctx: any = {
        aegis: createMockAegis(),
        logger: createMockLogger(),
        state: {
          authorization: { type: "bearer", value: "jwt-token" },
          tokens: {},
        },
      };

      ctx.aegis.verify.mockRejectedValue(new Error("invalid signature"));

      const middleware = createBearerTokenMiddleware(options);

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
