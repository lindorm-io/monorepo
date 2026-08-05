import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { isExpired } from "./is-expired.js";
import { isLive } from "./is-live.js";

const NOW = new Date("2024-01-01T08:00:00.000Z");

describe("isExpired", () => {
  test("should return true for a date in the past", () => {
    expect(isExpired(new Date("2023-01-01T08:00:00.000Z"), NOW)).toBe(true);
  });

  test("should return false for a date in the future", () => {
    expect(isExpired(new Date("2025-01-01T08:00:00.000Z"), NOW)).toBe(false);
  });

  // The load-bearing boundary: RFC 7519 §4.1.4 requires the current time to be
  // strictly before `exp`, so the exact millisecond of expiry is already spent.
  test("should return true when date equals now exactly", () => {
    expect(isExpired(NOW, new Date(NOW))).toBe(true);
  });

  test("should return true one millisecond before now", () => {
    expect(isExpired(new Date(NOW.getTime() - 1), NOW)).toBe(true);
  });

  test("should return false one millisecond after now", () => {
    expect(isExpired(new Date(NOW.getTime() + 1), NOW)).toBe(false);
  });

  // date-fns compares numeric time values, so an Invalid Date (NaN) fails every
  // comparison. Deliberate: no guard, no throw — an invalid date is neither
  // expired nor live.
  test("should return false for an invalid date", () => {
    expect(isExpired(new Date("nope"), NOW)).toBe(false);
    expect(isLive(new Date("nope"), NOW)).toBe(false);
  });

  test.each([-86400000, -1000, -1, 0, 1, 1000, 86400000])(
    "should be the exact complement of isLive at offset %i ms",
    (offset) => {
      const date = new Date(NOW.getTime() + offset);

      expect(isExpired(date, NOW)).not.toBe(isLive(date, NOW));
    },
  );

  test("should accept a number of epoch milliseconds", () => {
    expect(isExpired(NOW.getTime() - 1, NOW)).toBe(true);
    expect(isExpired(NOW.getTime(), NOW)).toBe(true);
    expect(isExpired(NOW.getTime() + 1, NOW)).toBe(false);
  });

  test("should accept a number as the now argument", () => {
    expect(isExpired(new Date(NOW.getTime() - 1), NOW.getTime())).toBe(true);
    expect(isExpired(NOW, NOW.getTime())).toBe(true);
    expect(isExpired(new Date(NOW.getTime() + 1), NOW.getTime())).toBe(false);
  });

  test("should accept an ISO string", () => {
    expect(isExpired("2023-01-01T08:00:00.000Z", NOW)).toBe(true);
    expect(isExpired("2024-01-01T08:00:00.000Z", NOW)).toBe(true);
    expect(isExpired("2025-01-01T08:00:00.000Z", NOW)).toBe(false);
  });

  test("should accept an ISO string as the now argument", () => {
    expect(isExpired(NOW, "2024-01-01T08:00:00.000Z")).toBe(true);
    expect(isExpired(NOW, "2025-01-01T08:00:00.000Z")).toBe(true);
    expect(isExpired(NOW, "2023-01-01T08:00:00.000Z")).toBe(false);
  });

  describe("default now", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("should default now to the current time", () => {
      expect(isExpired(new Date(NOW.getTime() - 1))).toBe(true);
      expect(isExpired(new Date(NOW))).toBe(true);
      expect(isExpired(new Date(NOW.getTime() + 1))).toBe(false);
    });
  });
});
