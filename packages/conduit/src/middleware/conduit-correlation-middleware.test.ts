import { conduitCorrelationMiddleware } from "./conduit-correlation-middleware";
import { beforeEach, describe, expect, test, vi } from "vitest";

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
      conduitCorrelationMiddleware("correlation-123")(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.req.metadata.correlationId).toBe("correlation-123");
  });

  test("should call next middleware", async () => {
    const next = vi.fn();

    await conduitCorrelationMiddleware("correlation-456")(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
