import MockDate from "mockdate";
import Stream, { Readable } from "stream";
import { httpResponseBodyMiddleware } from "./http-response-body-middleware.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("httpResponseBodyMiddleware", () => {
  const array = ["array"];
  const date = MockedDate;
  const error = new Error("error");
  const string = "string";

  let ctx: any;

  beforeEach(() => {
    ctx = {
      body: {
        PascalCaseTwo: "PascalCaseTwo",
        camelCaseTwo: "camelCaseTwo",
        snake_case_two: "snake_case_two",
        array,
        date,
        error,
        string,
      },
    };
  });

  test("should transform response body when object", async () => {
    await expect(httpResponseBodyMiddleware(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({
      array: ["array"],
      camel_case_two: "camelCaseTwo",
      date: date,
      error: error,
      pascal_case_two: "PascalCaseTwo",
      snake_case_two: "snake_case_two",
      string: "string",
    });
  });

  test("should transform response body when array", async () => {
    ctx.body = [{ String: "string" }];

    await expect(httpResponseBodyMiddleware(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual([{ string: "string" }]);
  });

  test("should not transform response body when stream", async () => {
    ctx.body = Readable.from("string");

    await expect(httpResponseBodyMiddleware(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual(expect.any(Stream));
  });

  test("should not transform response body when undefined", async () => {
    ctx.body = undefined;

    await expect(httpResponseBodyMiddleware(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.body).toBeUndefined();
  });

  test("should not transform response body when string", async () => {
    ctx.body = "string";

    await expect(httpResponseBodyMiddleware(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual("string");
  });

  test("x5t#S256 survives the response body", async () => {
    ctx.body = { keys: [{ kid: "k", "x5t#S256": "thumb", x5c: ["MII"] }] };

    await expect(httpResponseBodyMiddleware(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({ keys: [{ kid: "k", "x5t#S256": "thumb", x5c: ["MII"] }] });
  });

  test("a namespaced claim key survives", async () => {
    ctx.body = { sub: "s", "https://claims.lindorm.io/tenant": "acme" };

    await expect(httpResponseBodyMiddleware(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({ sub: "s", "https://claims.lindorm.io/tenant": "acme" });
  });

  test("a camelCase key still snake-cases", async () => {
    ctx.body = { tenantId: "t" };

    await expect(httpResponseBodyMiddleware(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({ tenant_id: "t" });
  });

  test("a key with punctuation and an upper-case letter survives", async () => {
    ctx.body = { "X-Request-Id": "r" };

    await expect(httpResponseBodyMiddleware(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({ "X-Request-Id": "r" });
  });

  test("an underscore alone does not exempt a key", async () => {
    ctx.body = { mixed_camelCase: 1 };

    await expect(httpResponseBodyMiddleware(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({ mixed_camel_case: 1 });
  });

  test("the exemption holds at every depth", async () => {
    ctx.body = {
      tokenClaims: { "https://claims.lindorm.io/tenant": { tenantId: 1 }, issuedAt: 1 },
    };

    await expect(httpResponseBodyMiddleware(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({
      token_claims: { "https://claims.lindorm.io/tenant": { tenantId: 1 }, issued_at: 1 },
    });
  });

  test("an exempt key's value is kept by reference", async () => {
    const tenant = { tenantId: 1 };
    ctx.body = { tokenClaims: { "https://claims.lindorm.io/tenant": tenant } };

    await expect(httpResponseBodyMiddleware(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.body.token_claims["https://claims.lindorm.io/tenant"]).toBe(tenant);
  });

  test("an array of objects is walked", async () => {
    ctx.body = [{ "x5t#S256": "a", keyId: "k" }, { keyId: "j" }];

    await expect(httpResponseBodyMiddleware(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual([{ "x5t#S256": "a", key_id: "k" }, { key_id: "j" }]);
  });
});
