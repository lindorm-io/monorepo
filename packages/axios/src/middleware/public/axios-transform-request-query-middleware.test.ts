import { TransformMode } from "@lindorm-io/case";
import { Next } from "@lindorm-io/middleware";
import { axiosTransformRequestQueryMiddleware } from "./axios-transform-request-query-middleware";

describe("axiosTransformRequestQueryMiddleware", () => {
  let ctx: any;
  let next: Next;

  beforeEach(() => {
    ctx = {
      req: {
        query: { PascalCase: "PascalCase", snake_case: "snake_case", camelCase: "camelCase" },
      },
    };

    next = () => Promise.resolve();
  });

  test("should resolve with camelCase for request object", async () => {
    await expect(
      axiosTransformRequestQueryMiddleware(TransformMode.CAMEL)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.req.query).toStrictEqual({
      camelCase: "camelCase",
      pascalCase: "PascalCase",
      snakeCase: "snake_case",
    });
  });
});
