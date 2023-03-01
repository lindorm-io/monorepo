import MockDate from "mockdate";
import { expiryObject } from "./expiry-object";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("expiryObject", () => {
  test("should resolve", () => {
    expect(expiryObject("10 minutes")).toStrictEqual({
      expires: new Date("2021-01-01T08:10:00.000Z"),
      expiresIn: 600,
      expiresUnix: 1609488600,
      now: new Date("2021-01-01T08:00:00.000Z"),
      nowUnix: 1609488000,
    });
  });
});
