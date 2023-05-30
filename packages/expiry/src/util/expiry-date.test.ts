import MockDate from "mockdate";
import { expiryDate } from "./expiry-date";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("expiryDate", () => {
  test("should convert string to expiry", () => {
    expect(expiryDate("10m")).toStrictEqual(new Date("2021-01-01T08:10:00.000Z"));
  });

  test("should convert number to expiry", () => {
    expect(expiryDate(1609488600)).toStrictEqual(new Date("2021-01-01T08:10:00.000Z"));
  });

  test("should convert date to expiry", () => {
    expect(expiryDate(new Date("2021-01-01T08:10:00.000Z"))).toStrictEqual(
      new Date("2021-01-01T08:10:00.000Z"),
    );
  });

  test("should throw when expiry is invalid type", () => {
    // @ts-ignore
    expect(() => expiryDate(true)).toThrow();
  });

  test("should throw when number expiry is not in seconds", () => {
    expect(() => expiryDate(10000000000)).toThrow();
  });

  test("should throw when expiry is before current date", () => {
    expect(() => expiryDate(new Date("1999-01-01T08:00:00.000Z"))).toThrow();
  });
});
