import * as d from "date-fns";
import { getUnixTime } from "./get-unix-time";

describe("getUnixTime", () => {
  test("should resolve date", () => {
    expect(getUnixTime(new Date("2000-01-01T00:00:00.000Z"))).toStrictEqual(
      d.getUnixTime(new Date("2000-01-01T00:00:00.000Z")),
    );
  });

  test("should resolve date with floor", () => {
    expect(getUnixTime(new Date("2000-01-01T00:00:00.600Z"))).toStrictEqual(
      d.getUnixTime(new Date("2000-01-01T00:00:00.600Z")),
    );
  });
});
