import { describe, expect, test } from "vitest";
import { isBeforeOrEqual } from "./is-before-or-equal.js";

const COMPARE = new Date("2024-01-01T08:00:00.000Z");

describe("isBeforeOrEqual", () => {
  test("should return true for a date before the comparison date", () => {
    expect(isBeforeOrEqual(new Date("2023-01-01T08:00:00.000Z"), COMPARE)).toBe(true);
  });

  test("should return false for a date after the comparison date", () => {
    expect(isBeforeOrEqual(new Date("2025-01-01T08:00:00.000Z"), COMPARE)).toBe(false);
  });

  // The inclusive half of `<=` — the reason this predicate exists at all.
  test("should return true when the dates are exactly equal", () => {
    expect(isBeforeOrEqual(new Date(COMPARE), new Date(COMPARE))).toBe(true);
  });

  test("should return true one millisecond before the comparison date", () => {
    expect(isBeforeOrEqual(new Date(COMPARE.getTime() - 1), COMPARE)).toBe(true);
  });

  test("should return false one millisecond after the comparison date", () => {
    expect(isBeforeOrEqual(new Date(COMPARE.getTime() + 1), COMPARE)).toBe(false);
  });

  // date-fns compares numeric time values, so an Invalid Date (NaN) fails every
  // comparison. Deliberate: no guard, no throw.
  test("should return false for an invalid date", () => {
    expect(isBeforeOrEqual(new Date("nope"), COMPARE)).toBe(false);
    expect(isBeforeOrEqual(COMPARE, new Date("nope"))).toBe(false);
  });

  test("should accept a number of epoch milliseconds", () => {
    expect(isBeforeOrEqual(COMPARE.getTime(), COMPARE.getTime())).toBe(true);
    expect(isBeforeOrEqual(COMPARE.getTime() - 1, COMPARE)).toBe(true);
    expect(isBeforeOrEqual(COMPARE.getTime() + 1, COMPARE)).toBe(false);
  });

  test("should accept an ISO string", () => {
    expect(isBeforeOrEqual("2024-01-01T08:00:00.000Z", "2024-01-01T08:00:00.000Z")).toBe(
      true,
    );
    expect(isBeforeOrEqual("2023-01-01T08:00:00.000Z", COMPARE)).toBe(true);
    expect(isBeforeOrEqual("2025-01-01T08:00:00.000Z", COMPARE)).toBe(false);
  });
});
