import { describe, expect, test } from "vitest";
import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isInteger } from "./is-integer.js";

describe("isInteger", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isInteger(value)).toMatchSnapshot();
  });

  // The shared fixtures carry no fractional number, so the sweep above cannot
  // tell `isInteger` from `isFinite`. These cases are what make it a whole-number
  // guard rather than a finite-number one.
  test.each([
    [0, true],
    [-0, true],
    [7, true],
    [-7, true],
    [1.5, false],
    [-1.5, false],
    [0.1, false],
    [Number.MAX_SAFE_INTEGER, true],
    // Not a lost case: float64 cannot represent MAX_SAFE_INTEGER + 0.5, so it
    // rounds to a whole number before the guard ever sees it.
    [Number.MAX_SAFE_INTEGER + 0.5, true],
    [Number.EPSILON, false],
  ])("should resolve %s as %s", (value, expected) => {
    expect(isInteger(value)).toBe(expected);
  });
});
