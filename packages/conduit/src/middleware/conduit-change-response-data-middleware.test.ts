import { ChangeCase } from "@lindorm/case";
import { conduitChangeResponseDataMiddleware } from "./conduit-change-response-data-middleware";

describe("conduitChangeResponseDataMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      res: {
        data: {
          PascalCase: "PascalCase",
          snake_case: "snake_case",
          camelCase: "camelCase",
        },
      },
    };
  });

  test("should resolve with default case", async () => {
    await expect(
      conduitChangeResponseDataMiddleware()(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.res.data).toEqual({
      camelCase: "camelCase",
      pascalCase: "PascalCase",
      snakeCase: "snake_case",
    });
  });

  test("should resolve with snake_case for response object", async () => {
    await expect(
      conduitChangeResponseDataMiddleware(ChangeCase.Snake)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.res.data).toEqual({
      camel_case: "camelCase",
      pascal_case: "PascalCase",
      snake_case: "snake_case",
    });
  });

  test("should resolve with snake_case for response array", async () => {
    ctx.res.data = [ctx.res.data, ctx.res.data];

    await expect(
      conduitChangeResponseDataMiddleware(ChangeCase.Snake)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.res.data).toEqual([
      { camel_case: "camelCase", pascal_case: "PascalCase", snake_case: "snake_case" },
      { camel_case: "camelCase", pascal_case: "PascalCase", snake_case: "snake_case" },
    ]);
  });
});
