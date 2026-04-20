import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/jest";
import { PylonError } from "../../errors";
import { createBasicAuthMiddleware } from "./create-basic-auth-middleware";

describe("createBasicAuthMiddleware", () => {
  let next: jest.Mock;

  const credentials = [
    { username: "admin", password: "secret" },
    { username: "user", password: "pass123" },
  ];

  beforeEach(() => {
    next = jest.fn();
  });

  const createCtx = (username: string, password: string): any => ({
    logger: createMockLogger(),
    state: {
      authorization: {
        type: "basic",
        value: Buffer.from(`${username}:${password}`).toString("base64"),
      },
      tokens: {},
    },
  });

  describe("array mode", () => {
    test("should resolve with valid credentials", async () => {
      const ctx = createCtx("admin", "secret");
      const middleware = createBasicAuthMiddleware(credentials);

      await expect(middleware(ctx, next)).resolves.toBeUndefined();
    });

    test("should throw 401 when username not found", async () => {
      const ctx = createCtx("unknown", "secret");
      const middleware = createBasicAuthMiddleware(credentials);

      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);

      try {
        await middleware(ctx, next);
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.message).toMatchSnapshot();
      }
    });

    test("should throw 401 when password does not match", async () => {
      const ctx = createCtx("admin", "wrong");
      const middleware = createBasicAuthMiddleware(credentials);

      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);

      try {
        await middleware(ctx, next);
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.message).toMatchSnapshot();
      }
    });
  });

  describe("custom verify function", () => {
    test("should resolve with custom verify function", async () => {
      const ctx = createCtx("custom", "pass");
      const verifyFn = jest.fn().mockResolvedValue(undefined);
      const middleware = createBasicAuthMiddleware(verifyFn);

      await expect(middleware(ctx, next)).resolves.toBeUndefined();

      expect(verifyFn).toHaveBeenCalledWith("custom", "pass");
    });
  });

  describe("authorization type", () => {
    test("should throw 401 when authorization type is not basic", async () => {
      const ctx: any = {
        logger: createMockLogger(),
        state: {
          authorization: { type: "bearer", value: "some-token" },
          tokens: {},
        },
      };

      const middleware = createBasicAuthMiddleware(credentials);

      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);

      try {
        await middleware(ctx, next);
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.message).toMatchSnapshot();
      }
    });
  });

  describe("credentials format", () => {
    test("should throw 401 when credentials format is invalid (no colon)", async () => {
      const ctx: any = {
        logger: createMockLogger(),
        state: {
          authorization: {
            type: "basic",
            value: Buffer.from("nocolonhere").toString("base64"),
          },
          tokens: {},
        },
      };

      const middleware = createBasicAuthMiddleware(credentials);

      await expect(middleware(ctx, next)).rejects.toThrow(ClientError);

      try {
        await middleware(ctx, next);
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.message).toMatchSnapshot();
      }
    });
  });

  describe("factory validation", () => {
    test("should throw PylonError when empty credentials array", () => {
      expect(() => createBasicAuthMiddleware([])).toThrow(PylonError);
    });
  });

  describe("next", () => {
    test("should call next", async () => {
      const ctx = createCtx("admin", "secret");
      const middleware = createBasicAuthMiddleware(credentials);

      await middleware(ctx, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
