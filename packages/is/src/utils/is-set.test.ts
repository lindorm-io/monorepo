import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isSet } from "./is-set.js";
import { describe, expect, test } from "vitest";

describe("isSet", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isSet(value)).toMatchSnapshot();
  });

  test("should accept sets", () => {
    expect(isSet(new Set())).toBe(true);
    expect(isSet(new Set([1, 2]))).toBe(true);
  });

  test("should reject anything else", () => {
    expect(isSet(new WeakSet())).toBe(false);
    expect(isSet(new Map([["a", 1]]))).toBe(false);
    expect(isSet([1, 2])).toBe(false);
    expect(isSet(null)).toBe(false);
  });
});
