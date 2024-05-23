import { Next } from "@lindorm/middleware";
import { conduitHeadersMiddleware } from "./conduit-headers-middleware";

describe("conduitHeaderMiddleware", () => {
  let ctx: any;
  let next: Next;

  beforeEach(() => {
    ctx = {
      req: {
        headers: { existing: "header" },
      },
    };

    next = () => Promise.resolve();
  });

  test("should add headers to the request", async () => {
    await expect(
      conduitHeadersMiddleware({ new: "header-content" })(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.req.headers).toEqual({
      existing: "header",
      new: "header-content",
    });
  });
});
