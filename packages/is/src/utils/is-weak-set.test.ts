import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isWeakSet } from "./is-weak-set.js";
import { describe, expect, test } from "vitest";

describe("isWeakSet", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isWeakSet(value)).toMatchSnapshot();
  });

  test("should accept weak sets", () => {
    expect(isWeakSet(new WeakSet())).toBe(true);
  });

  test("should reject anything else", () => {
    expect(isWeakSet(new Set([1]))).toBe(false);
    expect(isWeakSet(new WeakMap())).toBe(false);
    expect(isWeakSet({})).toBe(false);
    expect(isWeakSet(null)).toBe(false);
  });
});
