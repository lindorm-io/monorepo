import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isWeakMap } from "./is-weak-map.js";
import { describe, expect, test } from "vitest";

describe("isWeakMap", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isWeakMap(value)).toMatchSnapshot();
  });

  test("should accept weak maps", () => {
    expect(isWeakMap(new WeakMap())).toBe(true);
  });

  test("should reject anything else", () => {
    expect(isWeakMap(new Map([["a", 1]]))).toBe(false);
    expect(isWeakMap(new WeakSet())).toBe(false);
    expect(isWeakMap({})).toBe(false);
    expect(isWeakMap(null)).toBe(false);
  });
});
