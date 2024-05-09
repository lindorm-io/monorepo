import { _millisecondsToDuration } from "./milliseconds-to-duration";
import { _readableToMilliseconds } from "./readable-to-milliseconds";

describe("millisecondsToDuration", () => {
  test("should return predictable duration", () => {
    expect(
      _millisecondsToDuration(
        _readableToMilliseconds(
          "1 years",
          "1 months",
          "1 weeks",
          "1 days",
          "1 hours",
          "1 minutes",
          "1 seconds",
          "1 milliseconds",
        ),
      ),
    ).toEqual({
      years: 1,
      months: 1,
      weeks: 1,
      days: 1,
      hours: 1,
      minutes: 1,
      seconds: 1,
      milliseconds: 1,
    });
  });

  test("should return duration", () => {
    expect(
      _millisecondsToDuration(
        _readableToMilliseconds(
          "3 years",
          "13 months",
          "6 weeks",
          "5 days",
          "2 hours",
          "8 minutes",
          "99 seconds",
          "1024 milliseconds",
        ),
      ),
    ).toEqual({
      years: 4,
      months: 2,
      weeks: 2,
      days: 2,
      hours: 15,
      minutes: 39,
      seconds: 40,
      milliseconds: 24,
    });
  });
});
