import { stringToDurationObject, stringToMilliseconds, stringToSeconds } from "./string-time";

describe("string-time.ts", () => {
  describe("stringToDurationObject", () => {
    test("should return years", () => {
      expect(stringToDurationObject("2 years").years).toBe(2);
    });

    test("should return months", () => {
      expect(stringToDurationObject("12 months").months).toBe(12);
    });

    test("should return days", () => {
      expect(stringToDurationObject("30 days").days).toBe(30);
    });

    test("should return hours", () => {
      expect(stringToDurationObject("24 hours").hours).toBe(24);
    });

    test("should return minutes", () => {
      expect(stringToDurationObject("60 minutes").minutes).toBe(60);
    });

    test("should return seconds", () => {
      expect(stringToDurationObject("15 seconds").seconds).toBe(15);
    });

    test("should return milliseconds", () => {
      expect(stringToDurationObject("180 milliseconds").milliseconds).toBe(180);
    });

    test("should return a full object", () => {
      expect(
        stringToDurationObject(
          "1 years 2 months 3 days 4 hours 5 minutes 6 seconds 7 milliseconds",
        ),
      ).toStrictEqual({
        days: 3,
        hours: 4,
        milliseconds: 7,
        minutes: 5,
        months: 2,
        seconds: 6,
        years: 1,
      });
    });

    test("should return 0 on wrong or missing input", () => {
      expect(stringToDurationObject("100 wrong")).toStrictEqual({
        days: 0,
        hours: 0,
        milliseconds: 0,
        minutes: 0,
        months: 0,
        seconds: 0,
        years: 0,
      });
    });
  });

  describe("stringToSeconds", () => {
    test("should return years", () => {
      expect(stringToSeconds("1 years")).toBe(31536000);
    });

    test("should return months", () => {
      expect(stringToSeconds("2 months")).toBe(5184000);
    });

    test("should return days", () => {
      expect(stringToSeconds("3 days")).toBe(259200);
    });

    test("should return hours", () => {
      expect(stringToSeconds("4 hours")).toBe(14400);
    });

    test("should return minutes", () => {
      expect(stringToSeconds("5 minutes")).toBe(300);
    });

    test("should return seconds", () => {
      expect(stringToSeconds("6 seconds")).toBe(6);
    });

    test("should round milliseconds down with Math", () => {
      expect(stringToSeconds("499 milliseconds")).toBe(0);
    });

    test("should round milliseconds up with Math", () => {
      expect(stringToSeconds("500 milliseconds")).toBe(1);
    });

    test("should return a combined number", () => {
      expect(
        stringToSeconds("1 years 2 months 3 days 4 hours 5 minutes 6 seconds 7 milliseconds"),
      ).toBe(36993906);
    });
  });

  describe("stringToMilliseconds", () => {
    test("should return years", () => {
      expect(stringToMilliseconds("1 years")).toBe(31536000000);
    });

    test("should return months", () => {
      expect(stringToMilliseconds("2 months")).toBe(5184000000);
    });

    test("should return days", () => {
      expect(stringToMilliseconds("3 days")).toBe(259200000);
    });

    test("should return hours", () => {
      expect(stringToMilliseconds("4 hours")).toBe(14400000);
    });

    test("should return minutes", () => {
      expect(stringToMilliseconds("5 minutes")).toBe(300000);
    });

    test("should return seconds", () => {
      expect(stringToMilliseconds("6 seconds")).toBe(6000);
    });

    test("should return milliseconds", () => {
      expect(stringToMilliseconds("70 milliseconds")).toBe(70);
    });

    test("should return a combined number", () => {
      expect(
        stringToMilliseconds("1 years 2 months 3 days 4 hours 5 minutes 6 seconds 7 milliseconds"),
      ).toBe(36993906007);
    });
  });
});
