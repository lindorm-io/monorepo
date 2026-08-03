import type { ChangeCase } from "@lindorm/case";
import { conduitChangeRequestBodyMiddleware } from "./conduit-change-request-body-middleware.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("conduitChangeRequestBodyMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      req: {
        body: {
          PascalCase: "PascalCase",
          snake_case: "snake_case",
          camelCase: "camelCase",
        },
      },
    };
  });

  test("should resolve with default case", async () => {
    await expect(
      conduitChangeRequestBodyMiddleware()(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.req.body).toEqual({
      camel_case: "camelCase",
      pascal_case: "PascalCase",
      snake_case: "snake_case",
    });
  });

  test("should resolve with camelCase for request array", async () => {
    ctx.req.body = [ctx.req.body, ctx.req.body];

    await expect(
      conduitChangeRequestBodyMiddleware("camel")(ctx, vi.fn()),
    ).resolves.toBeUndefined();

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
      conduitChangeRequestBodyMiddleware("camel")(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.req.body).toEqual({
      camelCase: "camelCase",
      pascalCase: "PascalCase",
      snakeCase: "snake_case",
    });
  });

  test("should resolve with default case for request form", async () => {
    ctx.req.body = undefined;
    ctx.req.form = new FormData();

    ctx.req.form.append("grantType", "client_credentials");
    ctx.req.form.append("clientId", "client-id");

    await expect(
      conduitChangeRequestBodyMiddleware()(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(Array.from(ctx.req.form.entries())).toEqual([
      ["grant_type", "client_credentials"],
      ["client_id", "client-id"],
    ]);
  });

  test("should resolve with camelCase for request form", async () => {
    ctx.req.body = undefined;
    ctx.req.form = new FormData();

    ctx.req.form.append("grant_type", "client_credentials");
    ctx.req.form.append("client_id", "client-id");

    await expect(
      conduitChangeRequestBodyMiddleware("camel")(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(Array.from(ctx.req.form.entries())).toEqual([
      ["grantType", "client_credentials"],
      ["clientId", "client-id"],
    ]);
  });

  test("should resolve for a request carrying both a body and a form", async () => {
    ctx.req.form = new FormData();
    ctx.req.form.append("grantType", "client_credentials");

    await expect(
      conduitChangeRequestBodyMiddleware()(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.req.body).toEqual({
      camel_case: "camelCase",
      pascal_case: "PascalCase",
      snake_case: "snake_case",
    });
    expect(Array.from(ctx.req.form.entries())).toEqual([
      ["grant_type", "client_credentials"],
    ]);
  });
});
