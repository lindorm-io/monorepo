import { duration } from "./duration";

describe("duration", () => {
  test("should resolve milliseconds", () => {
    expect(duration("6000s")).toEqual({
      days: 0,
      hours: 0,
      milliseconds: 0,
      minutes: 0,
      months: 0,
      seconds: 6000,
      weeks: 0,
      years: 0,
    });
  });

  test("should resolve readable time", () => {
    expect(duration(12345550)).toEqual({
      days: 0,
      hours: 3,
      milliseconds: 550,
      minutes: 25,
      months: 0,
      seconds: 45,
      weeks: 0,
      years: 0,
    });
  });
});
