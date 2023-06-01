import { readableToSeconds } from "./readable-to-seconds";
import { secondsToReadable } from "./seconds-to-readable";

describe("secondsToReadable", () => {
  test("should return years", () => {
    expect(secondsToReadable(readableToSeconds("2 years"))).toBe("2y");
  });

  test("should return months", () => {
    expect(secondsToReadable(readableToSeconds("14 months"))).toBe("14mo");
  });

  test("should return weeks", () => {
    expect(secondsToReadable(readableToSeconds("6 weeks"))).toBe("6w");
  });

  test("should return days", () => {
    expect(secondsToReadable(readableToSeconds("40 days"))).toBe("40d");
  });

  test("should return hours", () => {
    expect(secondsToReadable(readableToSeconds("27 hours"))).toBe("27h");
  });

  test("should return minutes", () => {
    expect(secondsToReadable(readableToSeconds("65 minutes"))).toBe("65m");
  });

  test("should return seconds", () => {
    expect(secondsToReadable(readableToSeconds("70 seconds"))).toBe("70s");
  });

  test("should return seconds", () => {
    expect(secondsToReadable(readableToSeconds("1230 milliseconds"))).toBe("1s");
  });
});
