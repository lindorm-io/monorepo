import { ChangeCase } from "@lindorm/case";
import { Next } from "@lindorm/middleware";
import { conduitChangeRequestHeadersMiddleware } from "./conduit-change-request-headers-middleware";

describe("conduitChangeRequestHeadersMiddleware", () => {
  let ctx: any;
  let next: Next;

  beforeEach(() => {
    ctx = {
      req: {
        headers: { PascalCase: "PascalCase", snake_case: "snake_case", camelCase: "camelCase" },
      },
    };

    next = () => Promise.resolve();
  });

  test("should resolve with default case", async () => {
    await expect(conduitChangeRequestHeadersMiddleware()(ctx, next)).resolves.not.toThrow();

    expect(ctx.req.headers).toEqual({
      "Camel-Case": "camelCase",
      "Pascal-Case": "PascalCase",
      "Snake-Case": "snake_case",
    });
  });

  test("should resolve with camelCase for request object", async () => {
    await expect(
      conduitChangeRequestHeadersMiddleware(ChangeCase.Camel)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.req.headers).toEqual({
      camelCase: "camelCase",
      pascalCase: "PascalCase",
      snakeCase: "snake_case",
    });
  });
});
