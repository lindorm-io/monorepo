import { TransformMode } from "@lindorm-io/case";
import { Next } from "@lindorm-io/middleware";
import { axiosTransformRequestBodyMiddleware } from "./axios-transform-request-body-middleware";

describe("axiosTransformRequestBodyMiddleware", () => {
  let ctx: any;
  let next: Next;

  beforeEach(() => {
    ctx = {
      req: {
        body: { PascalCase: "PascalCase", snake_case: "snake_case", camelCase: "camelCase" },
      },
    };

    next = () => Promise.resolve();
  });

  test("should resolve with camelCase for request object", async () => {
    await expect(
      axiosTransformRequestBodyMiddleware(TransformMode.CAMEL)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.req.body).toStrictEqual({
      camelCase: "camelCase",
      pascalCase: "PascalCase",
      snakeCase: "snake_case",
    });
  });
});
