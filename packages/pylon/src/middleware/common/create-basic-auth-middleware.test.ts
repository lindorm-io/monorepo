import { ClientError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { PylonError } from "../../errors/index.js";
import { createBasicAuthMiddleware } from "./create-basic-auth-middleware.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

describe("createBasicAuthMiddleware", () => {
  let next: Mock;

  const credentials = [
    { username: "admin", password: "secret" },
    { username: "user", password: "pass123" },
  ];

  beforeEach(() => {
    next = vi.fn();
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
      const verifyFn = vi.fn().mockResolvedValue(undefined);
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

  describe("rfc 7617 — colons in the password", () => {
    test("should keep a password containing colons intact", async () => {
      const password = "pa:ss:word";
      const ctx = createCtx("admin", password);
      const verifyFn = vi.fn().mockResolvedValue(undefined);

      await expect(
        createBasicAuthMiddleware(verifyFn)(ctx, next),
      ).resolves.toBeUndefined();

      expect(verifyFn).toHaveBeenCalledWith("admin", password);
    });

    test("should authenticate against a configured password containing colons", async () => {
      const ctx = createCtx("colon", "pa:ss:word");

      await expect(
        createBasicAuthMiddleware([{ username: "colon", password: "pa:ss:word" }])(
          ctx,
          next,
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe("rfc 6749 — urlencoded credentials", () => {
    test("should decode urlencoded client credentials", async () => {
      const ctx: any = {
        logger: createMockLogger(),
        state: {
          authorization: {
            type: "basic",
            value: Buffer.from("client%20id:s%3Ecret%26more").toString("base64"),
          },
          tokens: {},
        },
      };

      const verifyFn = vi.fn().mockResolvedValue(undefined);

      await expect(
        createBasicAuthMiddleware(verifyFn)(ctx, next),
      ).resolves.toBeUndefined();

      expect(verifyFn).toHaveBeenCalledWith("client id", "s>cret&more");
    });
  });

  describe("redaction", () => {
    test("should not log the password when the password does not match", async () => {
      const ctx = createCtx("admin", "wrong-password");

      try {
        await createBasicAuthMiddleware(credentials)(ctx, next);
      } catch (err: any) {
        // LindormError merges a wrapped error's debug into its own, so this payload covers
        // the whole chain — including the defaultCallback error, whose debug used to carry
        // both the supplied and the configured password.
        expect(JSON.stringify(err.debug)).not.toContain("wrong-password");
        expect(JSON.stringify(err.debug)).not.toContain("secret");
        expect(err.debug).toMatchSnapshot();
      }

      expect.assertions(3);
    });

    test("should not log the password when the verify callback rejects", async () => {
      const ctx = createCtx("admin", "top-secret");
      const verifyFn = vi.fn().mockRejectedValue(new Error("nope"));

      try {
        await createBasicAuthMiddleware(verifyFn)(ctx, next);
      } catch (err: any) {
        expect(JSON.stringify(err.debug)).not.toContain("top-secret");
        expect(err.debug).toMatchSnapshot();
      }

      expect.assertions(2);
    });

    test("should not log the decoded credentials when they are malformed", async () => {
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

      try {
        await createBasicAuthMiddleware(credentials)(ctx, next);
      } catch (err: any) {
        expect(JSON.stringify(err.debug)).not.toContain("nocolonhere");
        expect(err.debug).toMatchSnapshot();
      }

      expect.assertions(2);
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
