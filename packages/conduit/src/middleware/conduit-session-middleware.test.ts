import { conduitSessionMiddleware } from "./conduit-session-middleware";

describe("conduitSessionMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      req: {
        metadata: {},
      },
    };
  });

  test("should set sessionId in request metadata", async () => {
    await expect(
      conduitSessionMiddleware("session-abc")(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.req.metadata.sessionId).toBe("session-abc");
  });

  test("should call next middleware", async () => {
    const next = jest.fn();

    await conduitSessionMiddleware("session-xyz")(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
