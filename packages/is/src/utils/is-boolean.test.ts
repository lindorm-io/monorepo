import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isBoolean, isFalse, isTrue } from "./is-boolean.js";
import { describe, expect, test } from "vitest";

describe("isBoolean", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isBoolean(value)).toMatchSnapshot();
  });
});

describe("isTrue", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isTrue(value)).toMatchSnapshot();
  });

  test("should accept only the primitive true", () => {
    expect(isTrue(true)).toBe(true);
    expect(isTrue(false)).toBe(false);
  });

  // The strings are `isBooleanString`'s job. `isTrue` narrows to the literal
  // `true`, so accepting `"true"` would hand the caller a string typed as a
  // boolean.
  test("should reject the boolean strings", () => {
    expect(isTrue("true")).toBe(false);
    expect(isTrue("false")).toBe(false);
    expect(isTrue("TRUE")).toBe(false);
  });

  // `1 == true` but `1 === true` is false, and the guard is strict on purpose.
  test("should reject the numeric stand-ins", () => {
    expect(isTrue(1)).toBe(false);
    expect(isTrue(0)).toBe(false);
  });

  // A boxed `Boolean` is an object; it is never `=== true`, however truthy.
  test("should reject a boxed Boolean", () => {
    expect(isTrue(new Boolean(true))).toBe(false);
    expect(isTrue(new Boolean(false))).toBe(false);
  });

  test("should reject nullish and a missing argument", () => {
    expect(isTrue(null)).toBe(false);
    expect(isTrue(undefined)).toBe(false);
    expect(isTrue()).toBe(false);
  });
});

describe("isFalse", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isFalse(value)).toMatchSnapshot();
  });

  test("should accept only the primitive false", () => {
    expect(isFalse(false)).toBe(true);
    expect(isFalse(true)).toBe(false);
  });

  // Same split as `isTrue`: the strings belong to `isBooleanString`.
  test("should reject the boolean strings", () => {
    expect(isFalse("false")).toBe(false);
    expect(isFalse("true")).toBe(false);
    expect(isFalse("FALSE")).toBe(false);
  });

  // The trap `isFalse` exists to avoid: every falsy value is NOT `false`.
  test("should reject the falsy stand-ins", () => {
    expect(isFalse(0)).toBe(false);
    expect(isFalse(1)).toBe(false);
    expect(isFalse("")).toBe(false);
    expect(isFalse(NaN)).toBe(false);
  });

  // A boxed `Boolean(false)` is an object, so it is truthy AND not `=== false`.
  test("should reject a boxed Boolean", () => {
    expect(isFalse(new Boolean(false))).toBe(false);
    expect(isFalse(new Boolean(true))).toBe(false);
  });

  test("should reject nullish and a missing argument", () => {
    expect(isFalse(null)).toBe(false);
    expect(isFalse(undefined)).toBe(false);
    expect(isFalse()).toBe(false);
  });
});
