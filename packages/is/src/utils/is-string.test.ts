import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isString } from "./is-string.js";
import { describe, expect, test } from "vitest";

describe("isString", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isString(value)).toMatchSnapshot();
  });

  // `T` is only ever backed by `typeof input === "string"`, so it may name a
  // string type and nothing else. Unconstrained, it narrowed any string to any
  // shape the caller asked for — silently, and without a single check.
  test("should refuse a non-string type argument", () => {
    const value: unknown = "typescript";

    // @ts-expect-error a non-string type argument does not satisfy the constraint
    expect(isString<{ nope: true }>(value)).toBe(true);
  });

  // A string LITERAL UNION is the legitimate use. The guard still does not check
  // membership — the caller owns that — but the type it hands back can no longer
  // be something a string could never be.
  test("should narrow to a string literal union", () => {
    const value: unknown = "typescript";

    expect(isString<"typescript" | "typescript-zod">(value)).toBe(true);
    expect(isString<"typescript" | "typescript-zod">(42)).toBe(false);
  });
});
