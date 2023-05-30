import { stringDuration, stringMilliseconds, stringSeconds } from "./string-time";

describe("string-time.ts", () => {
  describe("stringToDurationObject", () => {
    describe("years", () => {
      test("should return years on years", () => {
        expect(stringDuration("1 years").years).toBe(1);
      });

      test("should return years on year", () => {
        expect(stringDuration("1 year").years).toBe(1);
      });

      test("should return years on yrs", () => {
        expect(stringDuration("1 yrs").years).toBe(1);
      });

      test("should return years on yr", () => {
        expect(stringDuration("1 yr").years).toBe(1);
      });

      test("should return years on y", () => {
        expect(stringDuration("1 y").years).toBe(1);
      });
    });

    describe("months", () => {
      test("should return months on months", () => {
        expect(stringDuration("12 months").months).toBe(12);
      });

      test("should return months on month", () => {
        expect(stringDuration("12 month").months).toBe(12);
      });

      test("should return months on mo", () => {
        expect(stringDuration("12 mo").months).toBe(12);
      });
    });

    describe("weeks", () => {
      test("should return weeks on weeks", () => {
        expect(stringDuration("52 weeks").weeks).toBe(52);
      });

      test("should return weeks on week", () => {
        expect(stringDuration("52 week").weeks).toBe(52);
      });

      test("should return weeks on w", () => {
        expect(stringDuration("52 w").weeks).toBe(52);
      });
    });

    describe("days", () => {
      test("should return days on days", () => {
        expect(stringDuration("30 days").days).toBe(30);
      });

      test("should return days on day", () => {
        expect(stringDuration("30 day").days).toBe(30);
      });

      test("should return days on d", () => {
        expect(stringDuration("30 d").days).toBe(30);
      });
    });

    describe("hours", () => {
      test("should return hours on hours", () => {
        expect(stringDuration("24 hours").hours).toBe(24);
      });

      test("should return hours on hour", () => {
        expect(stringDuration("24 hour").hours).toBe(24);
      });

      test("should return hours on hrs", () => {
        expect(stringDuration("24 hrs").hours).toBe(24);
      });

      test("should return hours on hr", () => {
        expect(stringDuration("24 hr").hours).toBe(24);
      });

      test("should return hours on h", () => {
        expect(stringDuration("24 h").hours).toBe(24);
      });
    });

    describe("minutes", () => {
      test("should return minutes on minutes", () => {
        expect(stringDuration("60 minutes").minutes).toBe(60);
      });

      test("should return minutes on minute", () => {
        expect(stringDuration("60 minute").minutes).toBe(60);
      });

      test("should return minutes on mins", () => {
        expect(stringDuration("60 mins").minutes).toBe(60);
      });

      test("should return minutes on min", () => {
        expect(stringDuration("60 min").minutes).toBe(60);
      });

      test("should return minutes on m", () => {
        expect(stringDuration("60 m").minutes).toBe(60);
      });
    });

    describe("seconds", () => {
      test("should return seconds on seconds", () => {
        expect(stringDuration("60 seconds").seconds).toBe(60);
      });

      test("should return seconds on second", () => {
        expect(stringDuration("60 second").seconds).toBe(60);
      });

      test("should return seconds on secs", () => {
        expect(stringDuration("60 secs").seconds).toBe(60);
      });

      test("should return seconds on sec", () => {
        expect(stringDuration("60 sec").seconds).toBe(60);
      });

      test("should return seconds on s", () => {
        expect(stringDuration("60 s").seconds).toBe(60);
      });
    });

    describe("milliseconds", () => {
      test("should return milliseconds on milliseconds", () => {
        expect(stringDuration("1000 milliseconds").milliseconds).toBe(1000);
      });

      test("should return milliseconds on millisecond", () => {
        expect(stringDuration("1000 millisecond").milliseconds).toBe(1000);
      });

      test("should return milliseconds on msecs", () => {
        expect(stringDuration("1000 msecs").milliseconds).toBe(1000);
      });

      test("should return milliseconds on msec", () => {
        expect(stringDuration("1000 msec").milliseconds).toBe(1000);
      });

      test("should return milliseconds on ms", () => {
        expect(stringDuration("1000 ms").milliseconds).toBe(1000);
      });
    });

    test("should accept multiple strings", () => {
      expect(
        stringDuration(
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
      expect(stringDuration("1y", "2mo", "3w", "4d", "5h", "6m", "7s", "8ms")).toStrictEqual({
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
      expect(() => stringDuration("1 wrong" as any)).toThrow(Error);
    });
  });

  describe("stringToSeconds", () => {
    test("should return years", () => {
      expect(stringSeconds("1 year")).toBe(31557600);
    });

    test("should return months", () => {
      expect(stringSeconds("1 month")).toBe(2635200);
    });

    test("should return week", () => {
      expect(stringSeconds("1 week")).toBe(604800);
    });

    test("should return days", () => {
      expect(stringSeconds("1 day")).toBe(86400);
    });

    test("should return hours", () => {
      expect(stringSeconds("1 hour")).toBe(3600);
    });

    test("should return minutes", () => {
      expect(stringSeconds("1 minute")).toBe(60);
    });

    test("should return seconds", () => {
      expect(stringSeconds("1 second")).toBe(1);
    });

    test("should round milliseconds down with Math", () => {
      expect(stringSeconds("499 milliseconds")).toBe(0);
    });

    test("should round milliseconds up with Math", () => {
      expect(stringSeconds("500 milliseconds")).toBe(1);
    });

    test("should return a combined number", () => {
      expect(
        stringSeconds(
          "1 years",
          "2 months",
          "3 weeks",
          "4 days",
          "5 hours",
          "6 minutes",
          "7 seconds",
          "500 milliseconds",
        ),
      ).toBe(39006368);
    });
  });

  describe("stringToMilliseconds", () => {
    test("should return years", () => {
      expect(stringMilliseconds("1 year")).toBe(31557600000);
    });

    test("should return months", () => {
      expect(stringMilliseconds("1 month")).toBe(2635200000);
    });

    test("should return weeks", () => {
      expect(stringMilliseconds("1 week")).toBe(604800000);
    });

    test("should return days", () => {
      expect(stringMilliseconds("1 day")).toBe(86400000);
    });

    test("should return hours", () => {
      expect(stringMilliseconds("1 hour")).toBe(3600000);
    });

    test("should return minutes", () => {
      expect(stringMilliseconds("1 minute")).toBe(60000);
    });

    test("should return seconds", () => {
      expect(stringMilliseconds("1 second")).toBe(1000);
    });

    test("should return milliseconds", () => {
      expect(stringMilliseconds("1 millisecond")).toBe(1);
    });

    test("should return a combined number", () => {
      expect(
        stringMilliseconds(
          "1 years",
          "2 months",
          "3 weeks",
          "4 days",
          "5 hours",
          "6 minutes",
          "7 seconds",
          "8 milliseconds",
        ),
      ).toBe(39006367008);
    });
  });
});
