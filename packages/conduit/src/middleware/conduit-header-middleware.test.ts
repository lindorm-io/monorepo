import { conduitHeaderMiddleware } from "./conduit-header-middleware";
import { beforeEach, describe, expect, test, vi } from "vitest";

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
      conduitHeaderMiddleware("new", "header-content")(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.req.headers).toEqual({
      existing: "header",
      new: "header-content",
    });
  });
});
