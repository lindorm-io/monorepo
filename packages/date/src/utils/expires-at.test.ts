import MockDate from "mockdate";
import { expiresAt } from "./expires-at";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("expiryDate", () => {
  test("should convert string to expiry", () => {
    expect(expiresAt("10m")).toEqual(new Date("2021-01-01T08:10:00.000Z"));
  });

  test("should convert date to expiry", () => {
    expect(expiresAt(new Date("2021-01-01T08:10:00.000Z"))).toEqual(
      new Date("2021-01-01T08:10:00.000Z"),
    );
  });

  test("should throw when expiry is before current date", () => {
    expect(() => expiresAt(new Date("1999-01-01T08:00:00.000Z"))).toThrow();
  });
});
