import { conduitBearerAuthMiddleware } from "./conduit-bearer-auth-middleware";

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
      conduitBearerAuthMiddleware("access-token-123")(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.req.headers).toEqual({
      existing: "header",
      Authorization: "Bearer access-token-123",
    });
  });

  test("should add Authorization header with custom token type", async () => {
    await expect(
      conduitBearerAuthMiddleware("jwt-token-456", "JWT")(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.req.headers).toEqual({
      existing: "header",
      Authorization: "JWT jwt-token-456",
    });
  });

  test("should override existing Authorization header", async () => {
    ctx.req.headers.Authorization = "Basic old-credentials";

    await conduitBearerAuthMiddleware("new-token")(ctx, jest.fn());

    expect(ctx.req.headers.Authorization).toBe("Bearer new-token");
  });

  test("should call next middleware", async () => {
    const next = jest.fn();

    await conduitBearerAuthMiddleware("token")(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
