import { conduitBearerAuthMiddleware } from "./conduit-bearer-auth-middleware";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("conduitBearerAuthMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      req: {
        headers: { existing: "header" },
      },
    };
  });

  test("should add Bearer Authorization header with default token type", async () => {
    await expect(
      conduitBearerAuthMiddleware("access-token-123")(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.req.headers).toEqual({
      existing: "header",
      Authorization: "Bearer access-token-123",
    });
  });

  test("should add Authorization header with custom token type", async () => {
    await expect(
      conduitBearerAuthMiddleware("jwt-token-456", "JWT")(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.req.headers).toEqual({
      existing: "header",
      Authorization: "JWT jwt-token-456",
    });
  });

  test("should override existing Authorization header", async () => {
    ctx.req.headers.Authorization = "Basic old-credentials";

    await conduitBearerAuthMiddleware("new-token")(ctx, vi.fn());

    expect(ctx.req.headers.Authorization).toBe("Bearer new-token");
  });

  test("should call next middleware", async () => {
    const next = vi.fn();

    await conduitBearerAuthMiddleware("token")(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
