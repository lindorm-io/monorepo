import { conduitHeaderMiddleware } from "./conduit-header-middleware";

describe("conduitHeaderMiddleware", () => {
  let ctx: any;
  let next: any;

  beforeEach(() => {
    ctx = {
      req: {
        headers: { existing: "header" },
      },
    };

    next = () => Promise.resolve();
  });

  test("should add a header to the request", async () => {
    await expect(
      conduitHeaderMiddleware("new", "header-content")(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.req.headers).toEqual({
      existing: "header",
      new: "header-content",
    });
  });
});
