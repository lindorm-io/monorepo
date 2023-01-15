import MockDate from "mockdate";
import { getExpiryDate } from "./get-expiry-date";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getExpiryDate", () => {
  test("should convert string to expiry", () => {
    expect(getExpiryDate("10 minutes")).toStrictEqual(new Date("2021-01-01T08:10:00.000Z"));
  });

  test("should convert number to expiry", () => {
    expect(getExpiryDate(1609488600)).toStrictEqual(new Date("2021-01-01T08:10:00.000Z"));
  });

  test("should convert date to expiry", () => {
    expect(getExpiryDate(new Date("2021-01-01T08:10:00.000Z"))).toStrictEqual(
      new Date("2021-01-01T08:10:00.000Z"),
    );
  });

  test("should throw when expiry is invalid type", () => {
    // @ts-ignore
    expect(() => getExpiryDate(true)).toThrow();
  });

  test("should throw when number expiry is not in seconds", () => {
    expect(() => getExpiryDate(10000000000)).toThrow();
  });

  test("should throw when expiry is before current date", () => {
    expect(() => getExpiryDate(new Date("1999-01-01T08:00:00.000Z"))).toThrow();
  });
});
