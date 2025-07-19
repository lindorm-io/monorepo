import { ChangeCase } from "@lindorm/case";
import { conduitChangeRequestHeadersMiddleware } from "./conduit-change-request-headers-middleware";

describe("conduitChangeRequestHeadersMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      req: {
        headers: {
          PascalCase: "PascalCase",
          snake_case: "snake_case",
          camelCase: "camelCase",
        },
      },
    };
  });

  test("should resolve with default case", async () => {
    await expect(
      conduitChangeRequestHeadersMiddleware()(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.req.headers).toEqual({
      "Camel-Case": "camelCase",
      "Pascal-Case": "PascalCase",
      "Snake-Case": "snake_case",
    });
  });

  test("should resolve with camelCase for request object", async () => {
    await expect(
      conduitChangeRequestHeadersMiddleware("camel")(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.req.headers).toEqual({
      camelCase: "camelCase",
      pascalCase: "PascalCase",
      snakeCase: "snake_case",
    });
  });
});
