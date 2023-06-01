import { millisecondsToReadable } from "./milliseconds-to-readable";
import { readableToMilliseconds } from "./readable-to-milliseconds";

describe("millisecondsToReadable", () => {
  test("should return years", () => {
    expect(millisecondsToReadable(readableToMilliseconds("2 years"))).toBe("2y");
  });

  test("should return months", () => {
    expect(millisecondsToReadable(readableToMilliseconds("14 months"))).toBe("14mo");
  });

  test("should return weeks", () => {
    expect(millisecondsToReadable(readableToMilliseconds("6 weeks"))).toBe("6w");
  });

  test("should return days", () => {
    expect(millisecondsToReadable(readableToMilliseconds("40 days"))).toBe("40d");
  });

  test("should return hours", () => {
    expect(millisecondsToReadable(readableToMilliseconds("27 hours"))).toBe("27h");
  });

  test("should return minutes", () => {
    expect(millisecondsToReadable(readableToMilliseconds("65 minutes"))).toBe("65m");
  });

  test("should return seconds", () => {
    expect(millisecondsToReadable(readableToMilliseconds("70 seconds"))).toBe("70s");
  });

  test("should return milliseconds", () => {
    expect(millisecondsToReadable(readableToMilliseconds("1230 milliseconds"))).toBe("1230ms");
  });
});
