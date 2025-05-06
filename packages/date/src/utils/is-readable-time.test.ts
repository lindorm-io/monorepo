import { UNIT_ANY_CASE } from "../types";
import { isReadableTime } from "./is-readable-time";

describe("isReadableTime", () => {
  test.each(UNIT_ANY_CASE)("should return true for valid readable time: %s", (unit) => {
    expect(isReadableTime(`99${unit}`)).toEqual(true);
  });

  test.each(UNIT_ANY_CASE)(
    "should return true for valid readable time with spaces: %s",
    (unit) => {
      expect(isReadableTime(`99 ${unit}`)).toEqual(true);
    },
  );

  test("should return false for invalid readable time", () => {
    expect(isReadableTime("99 yars")).toEqual(false);
  });

  test("should return false for invalid readable time", () => {
    expect(isReadableTime("Years")).toEqual(false);
  });

  test("should return false for invalid readable time", () => {
    expect(isReadableTime("Word Years")).toEqual(false);
  });
});
