import { cronNext } from "./cron-next.js";
import { describe, expect, test } from "vitest";

describe("cronNext", () => {
  const from = new Date("2026-07-08T12:30:00.000Z");

  test("should resolve the next daily fire time in UTC", () => {
    expect(cronNext("0 0 * * *", from)).toEqual(new Date("2026-07-09T00:00:00.000Z"));
  });

  test("should resolve the next fire time strictly after `from`", () => {
    expect(cronNext("*/15 * * * *", from)).toEqual(new Date("2026-07-08T12:45:00.000Z"));
  });

  test("should evaluate the expression in the given timezone", () => {
    // Midnight in Stockholm (UTC+2 in July) is 22:00 UTC the previous day.
    expect(cronNext("0 0 * * *", from, "Europe/Stockholm")).toEqual(
      new Date("2026-07-08T22:00:00.000Z"),
    );
  });

  test("should return null when the expression has no future match", () => {
    expect(cronNext("0 0 30 2 *", from)).toBeNull();
  });
});
