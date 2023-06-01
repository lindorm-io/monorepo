import { readableToSeconds } from "./readable-to-seconds";
import { secondsToDuration } from "./seconds-to-duration";

describe("secondsToDuration", () => {
  test("should return predictable duration", () => {
    expect(
      secondsToDuration(
        readableToSeconds(
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
    ).toStrictEqual({
      years: 1,
      months: 1,
      weeks: 1,
      days: 1,
      hours: 1,
      minutes: 1,
      seconds: 1,
      milliseconds: 0,
    });
  });

  test("should return duration", () => {
    expect(
      secondsToDuration(
        readableToSeconds(
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
    ).toStrictEqual({
      years: 4,
      months: 2,
      weeks: 2,
      days: 2,
      hours: 15,
      minutes: 39,
      seconds: 40,
      milliseconds: 0,
    });
  });
});
