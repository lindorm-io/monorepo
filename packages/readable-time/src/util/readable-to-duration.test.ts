import { readableToDuration } from "./readable-to-duration";

describe("readableToDuration", () => {
  describe("years", () => {
    test("should return years on years", () => {
      expect(readableToDuration("1 years").years).toBe(1);
    });

    test("should return years on year", () => {
      expect(readableToDuration("1 year").years).toBe(1);
    });

    test("should return years on yrs", () => {
      expect(readableToDuration("1 yrs").years).toBe(1);
    });

    test("should return years on yr", () => {
      expect(readableToDuration("1 yr").years).toBe(1);
    });

    test("should return years on y", () => {
      expect(readableToDuration("1 y").years).toBe(1);
    });
  });

  describe("months", () => {
    test("should return months on months", () => {
      expect(readableToDuration("12 months").months).toBe(12);
    });

    test("should return months on month", () => {
      expect(readableToDuration("12 month").months).toBe(12);
    });

    test("should return months on mo", () => {
      expect(readableToDuration("12 mo").months).toBe(12);
    });
  });

  describe("weeks", () => {
    test("should return weeks on weeks", () => {
      expect(readableToDuration("52 weeks").weeks).toBe(52);
    });

    test("should return weeks on week", () => {
      expect(readableToDuration("52 week").weeks).toBe(52);
    });

    test("should return weeks on w", () => {
      expect(readableToDuration("52 w").weeks).toBe(52);
    });
  });

  describe("days", () => {
    test("should return days on days", () => {
      expect(readableToDuration("30 days").days).toBe(30);
    });

    test("should return days on day", () => {
      expect(readableToDuration("30 day").days).toBe(30);
    });

    test("should return days on d", () => {
      expect(readableToDuration("30 d").days).toBe(30);
    });
  });

  describe("hours", () => {
    test("should return hours on hours", () => {
      expect(readableToDuration("24 hours").hours).toBe(24);
    });

    test("should return hours on hour", () => {
      expect(readableToDuration("24 hour").hours).toBe(24);
    });

    test("should return hours on hrs", () => {
      expect(readableToDuration("24 hrs").hours).toBe(24);
    });

    test("should return hours on hr", () => {
      expect(readableToDuration("24 hr").hours).toBe(24);
    });

    test("should return hours on h", () => {
      expect(readableToDuration("24 h").hours).toBe(24);
    });
  });

  describe("minutes", () => {
    test("should return minutes on minutes", () => {
      expect(readableToDuration("60 minutes").minutes).toBe(60);
    });

    test("should return minutes on minute", () => {
      expect(readableToDuration("60 minute").minutes).toBe(60);
    });

    test("should return minutes on mins", () => {
      expect(readableToDuration("60 mins").minutes).toBe(60);
    });

    test("should return minutes on min", () => {
      expect(readableToDuration("60 min").minutes).toBe(60);
    });

    test("should return minutes on m", () => {
      expect(readableToDuration("60 m").minutes).toBe(60);
    });
  });

  describe("seconds", () => {
    test("should return seconds on seconds", () => {
      expect(readableToDuration("60 seconds").seconds).toBe(60);
    });

    test("should return seconds on second", () => {
      expect(readableToDuration("60 second").seconds).toBe(60);
    });

    test("should return seconds on secs", () => {
      expect(readableToDuration("60 secs").seconds).toBe(60);
    });

    test("should return seconds on sec", () => {
      expect(readableToDuration("60 sec").seconds).toBe(60);
    });

    test("should return seconds on s", () => {
      expect(readableToDuration("60 s").seconds).toBe(60);
    });
  });

  describe("milliseconds", () => {
    test("should return milliseconds on milliseconds", () => {
      expect(readableToDuration("1000 milliseconds").milliseconds).toBe(1000);
    });

    test("should return milliseconds on millisecond", () => {
      expect(readableToDuration("1000 millisecond").milliseconds).toBe(1000);
    });

    test("should return milliseconds on msecs", () => {
      expect(readableToDuration("1000 msecs").milliseconds).toBe(1000);
    });

    test("should return milliseconds on msec", () => {
      expect(readableToDuration("1000 msec").milliseconds).toBe(1000);
    });

    test("should return milliseconds on ms", () => {
      expect(readableToDuration("1000 ms").milliseconds).toBe(1000);
    });
  });

  test("should accept multiple strings", () => {
    expect(
      readableToDuration(
        "1 years",
        "2 months",
        "3 weeks",
        "4 days",
        "5 hours",
        "6 minutes",
        "7 seconds",
        "8 milliseconds",
      ),
    ).toStrictEqual({
      days: 4,
      hours: 5,
      milliseconds: 8,
      minutes: 6,
      months: 2,
      seconds: 7,
      weeks: 3,
      years: 1,
    });
  });

  test("should accept strings with no spaces", () => {
    expect(readableToDuration("1y", "2mo", "3w", "4d", "5h", "6m", "7s", "8ms")).toStrictEqual({
      days: 4,
      hours: 5,
      milliseconds: 8,
      minutes: 6,
      months: 2,
      seconds: 7,
      weeks: 3,
      years: 1,
    });
  });

  test("should throw on wrong input", () => {
    expect(() => readableToDuration("1 wrong" as any)).toThrow(Error);
  });
});
