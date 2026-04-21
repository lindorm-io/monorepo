import { ChangeCase } from "@lindorm/case";
import { conduitChangeRequestQueryMiddleware } from "./conduit-change-request-query-middleware";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("conduitChangeRequestQueryMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      req: {
        query: {
          PascalCase: "PascalCase",
          snake_case: "snake_case",
          camelCase: "camelCase",
        },
      },
    };
  });

  test("should resolve with default case", async () => {
    await expect(
      conduitChangeRequestQueryMiddleware()(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.req.query).toEqual({
      camel_case: "camelCase",
      pascal_case: "PascalCase",
      snake_case: "snake_case",
    });
  });

  test("should resolve with camelCase for request object", async () => {
    await expect(
      conduitChangeRequestQueryMiddleware("camel")(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.req.query).toEqual({
      camelCase: "camelCase",
      pascalCase: "PascalCase",
      snakeCase: "snake_case",
    });
  });
});
