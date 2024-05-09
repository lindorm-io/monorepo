import { ChangeCase } from "@lindorm/case";
import { Next } from "@lindorm/middleware";
import { conduitChangeRequestBodyMiddleware } from "./conduit-change-request-body-middleware";

describe("conduitChangeRequestBodyMiddleware", () => {
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

  test("should resolve with default case", async () => {
    await expect(conduitChangeRequestBodyMiddleware()(ctx, next)).resolves.not.toThrow();

    expect(ctx.req.body).toEqual({
      camel_case: "camelCase",
      pascal_case: "PascalCase",
      snake_case: "snake_case",
    });
  });

  test("should resolve with camelCase for request array", async () => {
    ctx.req.body = [ctx.req.body, ctx.req.body];

    await expect(
      conduitChangeRequestBodyMiddleware(ChangeCase.Camel)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.req.body).toEqual([
      {
        camelCase: "camelCase",
        pascalCase: "PascalCase",
        snakeCase: "snake_case",
      },
      {
        camelCase: "camelCase",
        pascalCase: "PascalCase",
        snakeCase: "snake_case",
      },
    ]);
  });

  test("should resolve with camelCase for request object", async () => {
    await expect(
      conduitChangeRequestBodyMiddleware(ChangeCase.Camel)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.req.body).toEqual({
      camelCase: "camelCase",
      pascalCase: "PascalCase",
      snakeCase: "snake_case",
    });
  });
});
