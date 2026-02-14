import { conduitCorrelationMiddleware } from "./conduit-correlation-middleware";

describe("conduitCorrelationMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      req: {
        metadata: {},
      },
    };
  });

  test("should set correlationId in request metadata", async () => {
    await expect(
      conduitCorrelationMiddleware("correlation-123")(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.req.metadata.correlationId).toBe("correlation-123");
  });

  test("should call next middleware", async () => {
    const next = jest.fn();

    await conduitCorrelationMiddleware("correlation-456")(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
