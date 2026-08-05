import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { isExpired } from "./is-expired.js";
import { isLive } from "./is-live.js";

const NOW = new Date("2024-01-01T08:00:00.000Z");

describe("isLive", () => {
  test("should return false for a date in the past", () => {
    expect(isLive(new Date("2023-01-01T08:00:00.000Z"), NOW)).toBe(false);
  });

  test("should return true for a date in the future", () => {
    expect(isLive(new Date("2025-01-01T08:00:00.000Z"), NOW)).toBe(true);
  });

  // The load-bearing boundary: RFC 7519 §4.1.4 requires the current time to be
  // strictly before `exp`, so the exact millisecond of expiry is not live.
  test("should return false when date equals now exactly", () => {
    expect(isLive(NOW, new Date(NOW))).toBe(false);
  });

  test("should return false one millisecond before now", () => {
    expect(isLive(new Date(NOW.getTime() - 1), NOW)).toBe(false);
  });

  test("should return true one millisecond after now", () => {
    expect(isLive(new Date(NOW.getTime() + 1), NOW)).toBe(true);
  });

  // date-fns compares numeric time values, so an Invalid Date (NaN) fails every
  // comparison. Deliberate: no guard, no throw — an invalid date is neither
  // live nor expired.
  test("should return false for an invalid date", () => {
    expect(isLive(new Date("nope"), NOW)).toBe(false);
    expect(isExpired(new Date("nope"), NOW)).toBe(false);
  });

  test.each([-86400000, -1000, -1, 0, 1, 1000, 86400000])(
    "should be the exact complement of isExpired at offset %i ms",
    (offset) => {
      const date = new Date(NOW.getTime() + offset);

      expect(isLive(date, NOW)).not.toBe(isExpired(date, NOW));
    },
  );

  test("should accept a number of epoch milliseconds", () => {
    expect(isLive(NOW.getTime() - 1, NOW)).toBe(false);
    expect(isLive(NOW.getTime(), NOW)).toBe(false);
    expect(isLive(NOW.getTime() + 1, NOW)).toBe(true);
  });

  test("should accept a number as the now argument", () => {
    expect(isLive(new Date(NOW.getTime() - 1), NOW.getTime())).toBe(false);
    expect(isLive(NOW, NOW.getTime())).toBe(false);
    expect(isLive(new Date(NOW.getTime() + 1), NOW.getTime())).toBe(true);
  });

  test("should accept an ISO string", () => {
    expect(isLive("2023-01-01T08:00:00.000Z", NOW)).toBe(false);
    expect(isLive("2024-01-01T08:00:00.000Z", NOW)).toBe(false);
    expect(isLive("2025-01-01T08:00:00.000Z", NOW)).toBe(true);
  });

  test("should accept an ISO string as the now argument", () => {
    expect(isLive(NOW, "2024-01-01T08:00:00.000Z")).toBe(false);
    expect(isLive(NOW, "2025-01-01T08:00:00.000Z")).toBe(false);
    expect(isLive(NOW, "2023-01-01T08:00:00.000Z")).toBe(true);
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
      expect(isLive(new Date(NOW.getTime() - 1))).toBe(false);
      expect(isLive(new Date(NOW))).toBe(false);
      expect(isLive(new Date(NOW.getTime() + 1))).toBe(true);
    });
  });
});
