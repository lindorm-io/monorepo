import { createMockAegis } from "@lindorm/aegis/mocks/jest";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/jest";
import { createTokenMiddleware } from "./create-token-middleware";

describe("createTokenMiddleware", () => {
  let ctx: any;
  let options: any;
  let next: jest.Mock;

  beforeEach(() => {
    options = { contextKey: "idToken", issuer: "issuer" };
    next = jest.fn();
  });

  describe("HTTP context", () => {
    beforeEach(() => {
      ctx = {
        aegis: createMockAegis(),
        logger: createMockLogger(),
        state: { tokens: {} },
        request: { body: { id_token: "token_value" } },
      };
    });

    test("should verify token and write to ctx.state.tokens", async () => {
      const middleware = createTokenMiddleware(options)("request.body.id_token");

      await expect(middleware(ctx, next)).resolves.toBeUndefined();

      expect(ctx.aegis.jwt.verify).toHaveBeenCalledWith("token_value", options);
      expect(ctx.state.tokens.idToken).toMatchSnapshot();
    });

    test("should call next", async () => {
      const middleware = createTokenMiddleware(options)("request.body.id_token");

      await middleware(ctx, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test("should throw ClientError 401 when token is not a string and not optional", async () => {
      ctx.request.body.id_token = undefined;

      const middleware = createTokenMiddleware(options)("request.body.id_token");

      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);

      try {
        await middleware(ctx, next);
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.message).toMatchSnapshot();
      }
    });

    test("should resolve without verifying when token is missing and optional", async () => {
      ctx.request.body.id_token = undefined;

      const middleware = createTokenMiddleware(options)("request.body.id_token", true);

      await expect(middleware(ctx, next)).resolves.toBeUndefined();

      expect(ctx.aegis.jwt.verify).not.toHaveBeenCalled();
      expect(ctx.state.tokens.idToken).toBeUndefined();
    });

    test("should throw ClientError 401 when verification fails", async () => {
      ctx.aegis.jwt.verify.mockRejectedValue(new Error("invalid signature"));

      const middleware = createTokenMiddleware(options)("request.body.id_token");

      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);

      try {
        await middleware(ctx, next);
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.message).toMatchSnapshot();
      }
    });
  });

  describe("Socket context", () => {
    beforeEach(() => {
      ctx = {
        aegis: createMockAegis(),
        event: "test:event",
        logger: createMockLogger(),
        state: { tokens: {} },
        io: { socket: { data: { tokens: {} } } },
        args: { id_token: "token_value" },
      };
    });

    test("should verify token and write to both ctx.state.tokens and ctx.socket.data.tokens", async () => {
      const middleware = createTokenMiddleware(options)("args.id_token");

      await expect(middleware(ctx, next)).resolves.toBeUndefined();

      expect(ctx.aegis.jwt.verify).toHaveBeenCalledWith("token_value", options);
      expect(ctx.state.tokens.idToken).toMatchSnapshot();
      expect(ctx.io.socket.data.tokens.idToken).toMatchSnapshot();
    });
  });
});
