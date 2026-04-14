import { millisecondsToReadable } from "./milliseconds-to-readable";
import { readableToMilliseconds } from "./readable-to-milliseconds";

describe("millisecondsToReadable", () => {
  test("should return years", () => {
    expect(millisecondsToReadable(readableToMilliseconds("2 years"))).toEqual("2y");
  });

  test("should return months", () => {
    expect(millisecondsToReadable(readableToMilliseconds("14 months"))).toEqual("14mo");
  });

  test("should return weeks", () => {
    expect(millisecondsToReadable(readableToMilliseconds("6 weeks"))).toEqual("6w");
  });

  test("should return days", () => {
    expect(millisecondsToReadable(readableToMilliseconds("40 days"))).toEqual("40d");
  });

  test("should return hours", () => {
    expect(millisecondsToReadable(readableToMilliseconds("27 hours"))).toEqual("27h");
  });

  test("should return minutes", () => {
    expect(millisecondsToReadable(readableToMilliseconds("65 minutes"))).toEqual("65m");
  });

  test("should return seconds", () => {
    expect(millisecondsToReadable(readableToMilliseconds("70 seconds"))).toEqual("70s");
  });

  test("should return milliseconds", () => {
    expect(millisecondsToReadable(readableToMilliseconds("1230 milliseconds"))).toEqual(
      "1230ms",
    );
  });
});
