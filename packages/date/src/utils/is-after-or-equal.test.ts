import { describe, expect, test } from "vitest";
import { isAfterOrEqual } from "./is-after-or-equal.js";

const COMPARE = new Date("2024-01-01T08:00:00.000Z");

describe("isAfterOrEqual", () => {
  test("should return false for a date before the comparison date", () => {
    expect(isAfterOrEqual(new Date("2023-01-01T08:00:00.000Z"), COMPARE)).toBe(false);
  });

  test("should return true for a date after the comparison date", () => {
    expect(isAfterOrEqual(new Date("2025-01-01T08:00:00.000Z"), COMPARE)).toBe(true);
  });

  // The inclusive half of `>=` — the reason this predicate exists at all.
  test("should return true when the dates are exactly equal", () => {
    expect(isAfterOrEqual(new Date(COMPARE), new Date(COMPARE))).toBe(true);
  });

  test("should return false one millisecond before the comparison date", () => {
    expect(isAfterOrEqual(new Date(COMPARE.getTime() - 1), COMPARE)).toBe(false);
  });

  test("should return true one millisecond after the comparison date", () => {
    expect(isAfterOrEqual(new Date(COMPARE.getTime() + 1), COMPARE)).toBe(true);
  });

  // date-fns compares numeric time values, so an Invalid Date (NaN) fails every
  // comparison. Deliberate: no guard, no throw.
  test("should return false for an invalid date", () => {
    expect(isAfterOrEqual(new Date("nope"), COMPARE)).toBe(false);
    expect(isAfterOrEqual(COMPARE, new Date("nope"))).toBe(false);
  });

  test("should accept a number of epoch milliseconds", () => {
    expect(isAfterOrEqual(COMPARE.getTime(), COMPARE.getTime())).toBe(true);
    expect(isAfterOrEqual(COMPARE.getTime() + 1, COMPARE)).toBe(true);
    expect(isAfterOrEqual(COMPARE.getTime() - 1, COMPARE)).toBe(false);
  });

  test("should accept an ISO string", () => {
    expect(isAfterOrEqual("2024-01-01T08:00:00.000Z", "2024-01-01T08:00:00.000Z")).toBe(
      true,
    );
    expect(isAfterOrEqual("2025-01-01T08:00:00.000Z", COMPARE)).toBe(true);
    expect(isAfterOrEqual("2023-01-01T08:00:00.000Z", COMPARE)).toBe(false);
  });
});
