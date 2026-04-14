import { readableToMilliseconds } from "./readable-to-milliseconds";

describe("readableToMilliseconds", () => {
  test("should return years", () => {
    expect(readableToMilliseconds("1 year")).toEqual(31557600000);
  });

  test("should return months", () => {
    expect(readableToMilliseconds("1 month")).toEqual(2629800000);
  });

  test("should return weeks", () => {
    expect(readableToMilliseconds("1 week")).toEqual(604800000);
  });

  test("should return days", () => {
    expect(readableToMilliseconds("1 day")).toEqual(86400000);
  });

  test("should return hours", () => {
    expect(readableToMilliseconds("1 hour")).toEqual(3600000);
  });

  test("should return minutes", () => {
    expect(readableToMilliseconds("1 minute")).toEqual(60000);
  });

  test("should return seconds", () => {
    expect(readableToMilliseconds("1 second")).toEqual(1000);
  });

  test("should return milliseconds", () => {
    expect(readableToMilliseconds("1 millisecond")).toEqual(1);
  });

  test("should return a combined number", () => {
    expect(
      readableToMilliseconds(
        "1 years",
        "2 months",
        "3 weeks",
        "4 days",
        "5 hours",
        "6 minutes",
        "7 seconds",
        "8 milliseconds",
      ),
    ).toEqual(38995567008);
  });
});
