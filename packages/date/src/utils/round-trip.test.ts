import type { ReadableTime } from "../types/index.js";
import { duration } from "./duration.js";
import { ms } from "./ms.js";
import { describe, expect, test } from "vitest";

const inputs: Array<ReadableTime> = [
  "1ms",
  "500ms",
  "1s",
  "30s",
  "1m",
  "15m",
  "1h",
  "12h",
  "1d",
  "7d",
  "1w",
  "3w",
  "1mo",
  "6mo",
  "1y",
  "2y",
  "10y",
  "25y",
  "2 years",
  "18 months",
];

describe("round-trip", () => {
  describe("ms <-> readable", () => {
    test("snapshot of ms() inverse outputs", () => {
      const rows = inputs.map((input) => {
        const milliseconds = ms(input) as number;
        const back = ms(milliseconds) as ReadableTime;
        return { input, milliseconds, back };
      });

      expect(rows).toMatchSnapshot();
    });

    test.each(inputs)("should round-trip %s through ms()", (input) => {
      const milliseconds = ms(input) as number;
      const back = ms(milliseconds) as ReadableTime;

      expect(ms(back)).toBe(milliseconds);
    });
  });

  describe("duration()", () => {
    test("snapshot of duration() from readable and from ms", () => {
      const rows = inputs.map((input) => {
        const fromReadable = duration(input);
        const fromMs = duration(ms(input) as number);
        return { input, fromReadable, fromMs };
      });

      expect(rows).toMatchSnapshot();
    });

    test.each(inputs)("should round-trip %s through duration()", (input) => {
      const milliseconds = ms(input) as number;
      const dictFromReadable = duration(input);
      const dictFromMs = duration(milliseconds);

      // Both duration() forms must represent the same millisecond total as
      // the original input when summed back through the Gregorian constants.
      const sum = (dict: ReturnType<typeof duration>): number =>
        ms(`${dict.years}y` as ReadableTime) +
        ms(`${dict.months}mo` as ReadableTime) +
        ms(`${dict.weeks}w` as ReadableTime) +
        ms(`${dict.days}d` as ReadableTime) +
        ms(`${dict.hours}h` as ReadableTime) +
        ms(`${dict.minutes}m` as ReadableTime) +
        ms(`${dict.seconds}s` as ReadableTime) +
        ms(`${dict.milliseconds}ms` as ReadableTime);

      expect(sum(dictFromReadable)).toBe(milliseconds);
      expect(sum(dictFromMs)).toBe(milliseconds);
    });
  });
});
