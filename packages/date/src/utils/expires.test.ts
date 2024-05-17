import MockDate from "mockdate";
import { expires } from "./expires";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("expiryObject", () => {
  test("should resolve", () => {
    expect(expires("10 minutes")).toEqual({
      expiresAt: new Date("2021-01-01T08:10:00.000Z"),
      expiresIn: 600,
      expiresOn: 1609488600,
      from: new Date("2021-01-01T08:00:00.000Z"),
      fromUnix: 1609488000,
    });
  });
});
