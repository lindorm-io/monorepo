import { _readableToDuration } from "./readable-to-duration";

describe("readableToDuration", () => {
  describe("years", () => {
    test("should return years on years", () => {
      expect(_readableToDuration("1 years").years).toEqual(1);
    });

    test("should return years on year", () => {
      expect(_readableToDuration("1 year").years).toEqual(1);
    });

    test("should return years on yrs", () => {
      expect(_readableToDuration("1 yrs").years).toEqual(1);
    });

    test("should return years on yr", () => {
      expect(_readableToDuration("1 yr").years).toEqual(1);
    });

    test("should return years on y", () => {
      expect(_readableToDuration("1 y").years).toEqual(1);
    });
  });

  describe("months", () => {
    test("should return months on months", () => {
      expect(_readableToDuration("12 months").months).toEqual(12);
    });

    test("should return months on month", () => {
      expect(_readableToDuration("12 month").months).toEqual(12);
    });

    test("should return months on mo", () => {
      expect(_readableToDuration("12 mo").months).toEqual(12);
    });
  });

  describe("weeks", () => {
    test("should return weeks on weeks", () => {
      expect(_readableToDuration("52 weeks").weeks).toEqual(52);
    });

    test("should return weeks on week", () => {
      expect(_readableToDuration("52 week").weeks).toEqual(52);
    });

    test("should return weeks on w", () => {
      expect(_readableToDuration("52 w").weeks).toEqual(52);
    });
  });

  describe("days", () => {
    test("should return days on days", () => {
      expect(_readableToDuration("30 days").days).toEqual(30);
    });

    test("should return days on day", () => {
      expect(_readableToDuration("30 day").days).toEqual(30);
    });

    test("should return days on d", () => {
      expect(_readableToDuration("30 d").days).toEqual(30);
    });
  });

  describe("hours", () => {
    test("should return hours on hours", () => {
      expect(_readableToDuration("24 hours").hours).toEqual(24);
    });

    test("should return hours on hour", () => {
      expect(_readableToDuration("24 hour").hours).toEqual(24);
    });

    test("should return hours on hrs", () => {
      expect(_readableToDuration("24 hrs").hours).toEqual(24);
    });

    test("should return hours on hr", () => {
      expect(_readableToDuration("24 hr").hours).toEqual(24);
    });

    test("should return hours on h", () => {
      expect(_readableToDuration("24 h").hours).toEqual(24);
    });
  });

  describe("minutes", () => {
    test("should return minutes on minutes", () => {
      expect(_readableToDuration("60 minutes").minutes).toEqual(60);
    });

    test("should return minutes on minute", () => {
      expect(_readableToDuration("60 minute").minutes).toEqual(60);
    });

    test("should return minutes on mins", () => {
      expect(_readableToDuration("60 mins").minutes).toEqual(60);
    });

    test("should return minutes on min", () => {
      expect(_readableToDuration("60 min").minutes).toEqual(60);
    });

    test("should return minutes on m", () => {
      expect(_readableToDuration("60 m").minutes).toEqual(60);
    });
  });

  describe("seconds", () => {
    test("should return seconds on seconds", () => {
      expect(_readableToDuration("60 seconds").seconds).toEqual(60);
    });

    test("should return seconds on second", () => {
      expect(_readableToDuration("60 second").seconds).toEqual(60);
    });

    test("should return seconds on secs", () => {
      expect(_readableToDuration("60 secs").seconds).toEqual(60);
    });

    test("should return seconds on sec", () => {
      expect(_readableToDuration("60 sec").seconds).toEqual(60);
    });

    test("should return seconds on s", () => {
      expect(_readableToDuration("60 s").seconds).toEqual(60);
    });
  });

  describe("milliseconds", () => {
    test("should return milliseconds on milliseconds", () => {
      expect(_readableToDuration("1000 milliseconds").milliseconds).toEqual(1000);
    });

    test("should return milliseconds on millisecond", () => {
      expect(_readableToDuration("1000 millisecond").milliseconds).toEqual(1000);
    });

    test("should return milliseconds on msecs", () => {
      expect(_readableToDuration("1000 msecs").milliseconds).toEqual(1000);
    });

    test("should return milliseconds on msec", () => {
      expect(_readableToDuration("1000 msec").milliseconds).toEqual(1000);
    });

    test("should return milliseconds on ms", () => {
      expect(_readableToDuration("1000 ms").milliseconds).toEqual(1000);
    });
  });

  test("should accept multiple strings", () => {
    expect(
      _readableToDuration(
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
    expect(_readableToDuration("1y", "2mo", "3w", "4d", "5h", "6m", "7s", "8ms")).toEqual({
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
    expect(() => _readableToDuration("1 wrong" as any)).toThrow(Error);
  });
});
