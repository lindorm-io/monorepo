import { ChangeCase } from "@lindorm/case";
import { Next } from "@lindorm/middleware";
import { conduitChangeRequestQueryMiddleware } from "./conduit-change-request-query-middleware";

describe("conduitChangeRequestQueryMiddleware", () => {
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

  test("should resolve with default case", async () => {
    await expect(conduitChangeRequestQueryMiddleware()(ctx, next)).resolves.not.toThrow();

    expect(ctx.req.query).toEqual({
      camel_case: "camelCase",
      pascal_case: "PascalCase",
      snake_case: "snake_case",
    });
  });

  test("should resolve with camelCase for request object", async () => {
    await expect(
      conduitChangeRequestQueryMiddleware(ChangeCase.Camel)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.req.query).toEqual({
      camelCase: "camelCase",
      pascalCase: "PascalCase",
      snakeCase: "snake_case",
    });
  });
});
