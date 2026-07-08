import { isCron } from "./is-cron.js";
import { describe, expect, test } from "vitest";

describe("isCron", () => {
  test.each([
    "* * * * *",
    "0 0 * * *",
    "*/15 * * * *",
    "0 9-17 * * 1-5",
    "0 0 1 1 *",
    "0 0 * * 0",
  ])("should return true for valid cron expression: %s", (expression) => {
    expect(isCron(expression)).toEqual(true);
  });

  test.each(["not a cron", "0 0 * *", "99 0 * * *", "* * * * * * * *"])(
    "should return false for invalid cron expression: %s",
    (expression) => {
      expect(isCron(expression)).toEqual(false);
    },
  );

  test.each([undefined, null, 1000, {}, [], true])(
    "should return false for non-string input: %s",
    (input) => {
      expect(isCron(input)).toEqual(false);
    },
  );
});
