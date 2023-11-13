import { TransformMode } from "@lindorm-io/case";
import { Next } from "@lindorm-io/middleware";
import { axiosTransformResponseDataMiddleware } from "./axios-transform-response-data-middleware";

describe("axiosTransformResponseDataMiddleware", () => {
  let ctx: any;
  let next: Next;

  beforeEach(() => {
    ctx = {
      res: {
        data: { PascalCase: "PascalCase", snake_case: "snake_case", camelCase: "camelCase" },
      },
    };

    next = () => Promise.resolve();
  });

  test("should resolve with camelCase for response object", async () => {
    await expect(
      axiosTransformResponseDataMiddleware(TransformMode.CAMEL)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.res.data).toStrictEqual({
      camelCase: "camelCase",
      pascalCase: "PascalCase",
      snakeCase: "snake_case",
    });
  });

  test("should resolve with camelCase for response array", async () => {
    ctx.res.data = [ctx.res.data, ctx.res.data];

    await expect(
      axiosTransformResponseDataMiddleware(TransformMode.CAMEL)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.res.data).toStrictEqual([
      { camelCase: "camelCase", pascalCase: "PascalCase", snakeCase: "snake_case" },
      { camelCase: "camelCase", pascalCase: "PascalCase", snakeCase: "snake_case" },
    ]);
  });
});
