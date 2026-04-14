import { readableToDuration } from "./readable-to-duration";

describe("readableToDuration", () => {
  describe("years", () => {
    test("should return years on years", () => {
      expect(readableToDuration("1 years").years).toEqual(1);
    });

    test("should return years on year", () => {
      expect(readableToDuration("1 year").years).toEqual(1);
    });

    test("should return years on yrs", () => {
      expect(readableToDuration("1 yrs").years).toEqual(1);
    });

    test("should return years on yr", () => {
      expect(readableToDuration("1 yr").years).toEqual(1);
    });

    test("should return years on y", () => {
      expect(readableToDuration("1 y").years).toEqual(1);
    });
  });

  describe("months", () => {
    test("should return months on months", () => {
      expect(readableToDuration("12 months").months).toEqual(12);
    });

    test("should return months on month", () => {
      expect(readableToDuration("12 month").months).toEqual(12);
    });

    test("should return months on mo", () => {
      expect(readableToDuration("12 mo").months).toEqual(12);
    });
  });

  describe("weeks", () => {
    test("should return weeks on weeks", () => {
      expect(readableToDuration("52 weeks").weeks).toEqual(52);
    });

    test("should return weeks on week", () => {
      expect(readableToDuration("52 week").weeks).toEqual(52);
    });

    test("should return weeks on w", () => {
      expect(readableToDuration("52 w").weeks).toEqual(52);
    });
  });

  describe("days", () => {
    test("should return days on days", () => {
      expect(readableToDuration("30 days").days).toEqual(30);
    });

    test("should return days on day", () => {
      expect(readableToDuration("30 day").days).toEqual(30);
    });

    test("should return days on d", () => {
      expect(readableToDuration("30 d").days).toEqual(30);
    });
  });

  describe("hours", () => {
    test("should return hours on hours", () => {
      expect(readableToDuration("24 hours").hours).toEqual(24);
    });

    test("should return hours on hour", () => {
      expect(readableToDuration("24 hour").hours).toEqual(24);
    });

    test("should return hours on hrs", () => {
      expect(readableToDuration("24 hrs").hours).toEqual(24);
    });

    test("should return hours on hr", () => {
      expect(readableToDuration("24 hr").hours).toEqual(24);
    });

    test("should return hours on h", () => {
      expect(readableToDuration("24 h").hours).toEqual(24);
    });
  });

  describe("minutes", () => {
    test("should return minutes on minutes", () => {
      expect(readableToDuration("60 minutes").minutes).toEqual(60);
    });

    test("should return minutes on minute", () => {
      expect(readableToDuration("60 minute").minutes).toEqual(60);
    });

    test("should return minutes on mins", () => {
      expect(readableToDuration("60 mins").minutes).toEqual(60);
    });

    test("should return minutes on min", () => {
      expect(readableToDuration("60 min").minutes).toEqual(60);
    });

    test("should return minutes on m", () => {
      expect(readableToDuration("60 m").minutes).toEqual(60);
    });
  });

  describe("seconds", () => {
    test("should return seconds on seconds", () => {
      expect(readableToDuration("60 seconds").seconds).toEqual(60);
    });

    test("should return seconds on second", () => {
      expect(readableToDuration("60 second").seconds).toEqual(60);
    });

    test("should return seconds on secs", () => {
      expect(readableToDuration("60 secs").seconds).toEqual(60);
    });

    test("should return seconds on sec", () => {
      expect(readableToDuration("60 sec").seconds).toEqual(60);
    });

    test("should return seconds on s", () => {
      expect(readableToDuration("60 s").seconds).toEqual(60);
    });
  });

  describe("milliseconds", () => {
    test("should return milliseconds on milliseconds", () => {
      expect(readableToDuration("1000 milliseconds").milliseconds).toEqual(1000);
    });

    test("should return milliseconds on millisecond", () => {
      expect(readableToDuration("1000 millisecond").milliseconds).toEqual(1000);
    });

    test("should return milliseconds on msecs", () => {
      expect(readableToDuration("1000 msecs").milliseconds).toEqual(1000);
    });

    test("should return milliseconds on msec", () => {
      expect(readableToDuration("1000 msec").milliseconds).toEqual(1000);
    });

    test("should return milliseconds on ms", () => {
      expect(readableToDuration("1000 ms").milliseconds).toEqual(1000);
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
    ).toEqual({
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
    expect(readableToDuration("1y", "2mo", "3w", "4d", "5h", "6m", "7s", "8ms")).toEqual({
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
