import { _millisecondsToReadable } from "./milliseconds-to-readable";
import { _readableToMilliseconds } from "./readable-to-milliseconds";

describe("millisecondsToReadable", () => {
  test("should return years", () => {
    expect(_millisecondsToReadable(_readableToMilliseconds("2 years"))).toEqual("2y");
  });

  test("should return months", () => {
    expect(_millisecondsToReadable(_readableToMilliseconds("14 months"))).toEqual("14mo");
  });

  test("should return weeks", () => {
    expect(_millisecondsToReadable(_readableToMilliseconds("6 weeks"))).toEqual("6w");
  });

  test("should return days", () => {
    expect(_millisecondsToReadable(_readableToMilliseconds("40 days"))).toEqual("40d");
  });

  test("should return hours", () => {
    expect(_millisecondsToReadable(_readableToMilliseconds("27 hours"))).toEqual("27h");
  });

  test("should return minutes", () => {
    expect(_millisecondsToReadable(_readableToMilliseconds("65 minutes"))).toEqual("65m");
  });

  test("should return seconds", () => {
    expect(_millisecondsToReadable(_readableToMilliseconds("70 seconds"))).toEqual("70s");
  });

  test("should return milliseconds", () => {
    expect(_millisecondsToReadable(_readableToMilliseconds("1230 milliseconds"))).toEqual("1230ms");
  });
});
