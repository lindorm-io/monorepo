import { readableToSeconds } from "./readable-to-seconds";

describe("readableToSeconds", () => {
  test("should return years", () => {
    expect(readableToSeconds("1 year")).toBe(31557600);
  });

  test("should return months", () => {
    expect(readableToSeconds("1 month")).toBe(2629800);
  });

  test("should return week", () => {
    expect(readableToSeconds("1 week")).toBe(604800);
  });

  test("should return days", () => {
    expect(readableToSeconds("1 day")).toBe(86400);
  });

  test("should return hours", () => {
    expect(readableToSeconds("1 hour")).toBe(3600);
  });

  test("should return minutes", () => {
    expect(readableToSeconds("1 minute")).toBe(60);
  });

  test("should return seconds", () => {
    expect(readableToSeconds("1 second")).toBe(1);
  });

  test("should round milliseconds down with Math", () => {
    expect(readableToSeconds("499 milliseconds")).toBe(0);
  });

  test("should round milliseconds up with Math", () => {
    expect(readableToSeconds("500 milliseconds")).toBe(1);
  });

  test("should return a combined number", () => {
    expect(
      readableToSeconds(
        "1 years",
        "2 months",
        "3 weeks",
        "4 days",
        "5 hours",
        "6 minutes",
        "7 seconds",
        "500 milliseconds",
      ),
    ).toBe(38995568);
  });
});
