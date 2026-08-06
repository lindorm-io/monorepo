import type { ChangeCase } from "@lindorm/case";
import { conduitChangeResponseDataMiddleware } from "./conduit-change-response-data-middleware.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

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
      conduitChangeResponseDataMiddleware()(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.res.data).toEqual({
      camelCase: "camelCase",
      pascalCase: "PascalCase",
      snakeCase: "snake_case",
    });
  });

  test("should resolve with snake_case for response object", async () => {
    await expect(
      conduitChangeResponseDataMiddleware("snake")(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.res.data).toEqual({
      camel_case: "camelCase",
      pascal_case: "PascalCase",
      snake_case: "snake_case",
    });
  });

  // The inbound mirror of the request-body case: RFC 9396 §2 type-specific
  // fields on an incoming `authorization_details` must survive untouched.
  test("should leave nested response data verbatim beyond the given depth", async () => {
    ctx.res.data = {
      access_token: "at",
      authorization_details: [
        { type: "payment_initiation", instructedAmount: { currencyCode: "EUR" } },
      ],
    };

    await expect(
      conduitChangeResponseDataMiddleware("camel", { depth: 1 })(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.res.data).toEqual({
      accessToken: "at",
      authorizationDetails: [
        { type: "payment_initiation", instructedAmount: { currencyCode: "EUR" } },
      ],
    });
  });

  test("should resolve with snake_case for response array", async () => {
    ctx.res.data = [ctx.res.data, ctx.res.data];

    await expect(
      conduitChangeResponseDataMiddleware("snake")(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.res.data).toEqual([
      { camel_case: "camelCase", pascal_case: "PascalCase", snake_case: "snake_case" },
      { camel_case: "camelCase", pascal_case: "PascalCase", snake_case: "snake_case" },
    ]);
  });
});
