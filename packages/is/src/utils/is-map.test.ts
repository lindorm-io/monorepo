import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isMap } from "./is-map.js";
import { describe, expect, test } from "vitest";

describe("isMap", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isMap(value)).toMatchSnapshot();
  });

  test("should accept maps", () => {
    expect(isMap(new Map())).toBe(true);
    expect(isMap(new Map([["a", 1]]))).toBe(true);
  });

  test("should reject anything else", () => {
    expect(isMap(new WeakMap())).toBe(false);
    expect(isMap(new Set([1]))).toBe(false);
    expect(isMap({})).toBe(false);
    expect(isMap(null)).toBe(false);
  });
});
