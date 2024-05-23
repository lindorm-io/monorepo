import { conduitHeaderMiddleware } from "./conduit-header-middleware";

describe("conduitHeaderMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      req: {
        headers: { existing: "header" },
      },
    };
  });

  test("should add a header to the request", async () => {
    await expect(
      conduitHeaderMiddleware("new", "header-content")(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.req.headers).toEqual({
      existing: "header",
      new: "header-content",
    });
  });
});
