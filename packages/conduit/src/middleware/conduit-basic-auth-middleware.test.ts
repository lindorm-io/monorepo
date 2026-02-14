import { conduitBasicAuthMiddleware } from "./conduit-basic-auth-middleware";

describe("conduitBasicAuthMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      req: {
        headers: { existing: "header" },
      },
    };
  });

  test("should add Basic Authorization header with base64-encoded credentials", async () => {
    await expect(
      conduitBasicAuthMiddleware("user123", "pass456")(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    const expectedToken = Buffer.from("user123:pass456").toString("base64");

    expect(ctx.req.headers).toEqual({
      existing: "header",
      Authorization: `Basic ${expectedToken}`,
    });
  });

  test("should override existing Authorization header", async () => {
    ctx.req.headers.Authorization = "Bearer old-token";

    await conduitBasicAuthMiddleware("admin", "secret")(ctx, jest.fn());

    const expectedToken = Buffer.from("admin:secret").toString("base64");

    expect(ctx.req.headers.Authorization).toBe(`Basic ${expectedToken}`);
  });

  test("should call next middleware", async () => {
    const next = jest.fn();

    await conduitBasicAuthMiddleware("user", "pass")(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
