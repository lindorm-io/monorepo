import MockDate from "mockdate";
import { getResponseTime } from "./get-response-time";

MockDate.set("2020-01-01T08:00:00.000Z");

describe("getResponseTime", () => {
  test("should return time object with data", () => {
    const start = Date.now();
    MockDate.set("2020-01-01T08:00:00.125Z");
    expect(getResponseTime({ "x-response-time": "100ms" }, start)).toStrictEqual({
      axios: 125,
      diff: 25,
      server: 100,
    });
  });
});
