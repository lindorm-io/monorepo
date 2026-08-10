import { isDateString } from "./is-date-string.js";
import { describe, expect, test } from "vitest";

describe("isDateString", () => {
  test.each([
    "2026-08-10T12:00:00Z",
    "2026-08-10T12:00:00.1Z",
    "2026-08-10T12:00:00.123Z",
    "2026-08-10T12:00:00.123456789Z",
    "2026-08-10T12:00:00+02:00",
    "2026-08-10T12:00:00-05:30",
    "2026-08-10T12:00:00.500+00:00",
    "2026-08-10T00:00:00Z",
    "2026-08-10T23:59:59.999Z",
    "2024-02-29T00:00:00Z",
    "2026-12-31T23:59:59-23:59",
    "0001-01-01T00:00:00Z",
    new Date().toISOString(),
  ])("should return true for valid date string: %s", (input) => {
    expect(isDateString(input)).toEqual(true);
  });

  test.each([
    "2026-13-45T99:99:99Z",
    "2026-13-10T12:00:00Z",
    "2026-00-10T12:00:00Z",
    "2026-08-32T12:00:00Z",
    "2026-08-00T12:00:00Z",
    "2026-02-30T12:00:00Z",
    "2026-02-29T12:00:00Z",
    "2026-04-31T12:00:00Z",
    "2026-08-10T25:00:00Z",
    "2026-08-10T12:60:00Z",
    "2026-08-10T12:00:60Z",
    "2026-08-10T12:00:00+24:00",
    "2026-08-10T12:00:00+99:00",
    "2026-08-10T12:00:00-24:00",
    "2026-08-10T12:00:00+02:60",
  ])("should return false for impossible date string: %s", (input) => {
    expect(isDateString(input)).toEqual(false);
  });

  test.each([
    "2026-08-10",
    "2026-08-10T12:00:00",
    "2026-08-10T12:00:00.123",
    "2026-08-10T12:00:00+0200",
    "2026-08-10T12:00:00+02",
    "2026-08-10 12:00:00Z",
    "2026-08-10t12:00:00Z",
    "2026-08-10T12:00:00z",
    "2026-08-10T12:00Z",
    "26-08-10T12:00:00Z",
    "2026-8-10T12:00:00Z",
    "2026-08-10T12:00:00.Z",
    " 2026-08-10T12:00:00Z",
    "2026-08-10T12:00:00Z ",
    "not a date",
    "",
  ])("should return false for non-matching shape: %s", (input) => {
    expect(isDateString(input)).toEqual(false);
  });

  test.each([undefined, null, 1000, {}, [], true, new Date(), NaN])(
    "should return false for non-string input: %s",
    (input) => {
      expect(isDateString(input)).toEqual(false);
    },
  );
});
