import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../__fixtures__/app-config.js";
import { createTokenMiddleware } from "./create-token-middleware.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

describe("createTokenMiddleware", () => {
  let ctx: any;
  let options: any;
  let next: Mock;

  beforeEach(() => {
    options = { contextKey: "idToken", issuer: "issuer" };
    next = vi.fn();
  });

  describe("HTTP context", () => {
    beforeEach(() => {
      ctx = {
        aegis: createMockAegis(),
        logger: createMockLogger(),
        state: {
          app: { config: createTestAppConfig({ auth: createTestAuthConfig() }) },
          tokens: {},
        },
        request: { body: { id_token: "token_value" } },
      };
    });

    test("should verify token and write to ctx.state.tokens", async () => {
      const middleware = createTokenMiddleware(options)("request.body.id_token");

      await expect(middleware(ctx, next)).resolves.toBeUndefined();

      expect(ctx.aegis.verify).toHaveBeenCalledWith(
        "token_value",
        { issuer: "issuer" },
        { critical: [] },
      );
      expect(ctx.state.tokens.idToken).toMatchSnapshot();
    });

    test("forwards the deployment critical declaration to aegis", async () => {
      ctx.state.app.config = createTestAppConfig({
        auth: createTestAuthConfig({ critical: ["objectId"] }),
      });

      await createTokenMiddleware(options)("request.body.id_token")(ctx, next);

      expect(ctx.aegis.verify).toHaveBeenCalledWith(
        "token_value",
        { issuer: "issuer" },
        { critical: ["objectId"] },
      );
    });

    // The deployment's declaration is spread LAST at the verify site, so a
    // cast-in `critical` on the mount cannot widen it (type AND runtime).
    test("a route cannot widen the deployment's declaration", async () => {
      const middleware = createTokenMiddleware({
        ...options,
        critical: ["objectId"],
      } as any)("request.body.id_token");

      await middleware(ctx, next);

      expect(ctx.aegis.verify).toHaveBeenCalledWith(
        "token_value",
        { issuer: "issuer" },
        { critical: [] },
      );
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

      expect(ctx.aegis.verify).not.toHaveBeenCalled();
      expect(ctx.state.tokens.idToken).toBeUndefined();
    });

    test("should throw ClientError 401 when verification fails", async () => {
      ctx.aegis.verify.mockRejectedValue(new Error("invalid signature"));

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
        state: {
          app: { config: createTestAppConfig({ auth: createTestAuthConfig() }) },
          tokens: {},
        },
        io: { socket: { data: { tokens: {} } } },
        args: { id_token: "token_value" },
      };
    });

    test("should verify token and write to both ctx.state.tokens and ctx.socket.data.tokens", async () => {
      const middleware = createTokenMiddleware(options)("args.id_token");

      await expect(middleware(ctx, next)).resolves.toBeUndefined();

      expect(ctx.aegis.verify).toHaveBeenCalledWith(
        "token_value",
        { issuer: "issuer" },
        { critical: [] },
      );
      expect(ctx.state.tokens.idToken).toMatchSnapshot();
      expect(ctx.io.socket.data.tokens.idToken).toMatchSnapshot();
    });
  });
});
