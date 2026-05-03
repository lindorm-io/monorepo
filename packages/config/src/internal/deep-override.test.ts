import { describe, expect, test } from "vitest";
import { deepOverride } from "./deep-override.js";

describe("deepOverride", () => {
  test("returns an empty object given no sources", () => {
    expect(deepOverride()).toEqual({});
  });

  test("later sources override earlier ones for primitives", () => {
    expect(deepOverride({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  test("later sources REPLACE arrays — they are not concatenated", () => {
    expect(deepOverride({ hosts: ["a", "b"] }, { hosts: ["x"] })).toEqual({
      hosts: ["x"],
    });
  });

  test("nested objects merge recursively", () => {
    expect(
      deepOverride(
        { database: { url: "first", pool: 10 } },
        { database: { url: "second" } },
      ),
    ).toEqual({
      database: { url: "second", pool: 10 },
    });
  });

  test("undefined values are skipped", () => {
    expect(deepOverride({ a: 1 }, { a: undefined })).toEqual({ a: 1 });
  });

  test("undefined sources are tolerated", () => {
    expect(deepOverride(undefined, { a: 1 }, undefined)).toEqual({ a: 1 });
  });

  test("an object replaces a non-object value rather than mutating it", () => {
    expect(deepOverride({ a: 1 }, { a: { nested: true } })).toEqual({
      a: { nested: true },
    });
  });

  test("a non-object value replaces an object value", () => {
    expect(deepOverride({ a: { nested: true } }, { a: "string" })).toEqual({
      a: "string",
    });
  });
});
