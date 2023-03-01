import MockDate from "mockdate";
import { expiresAt } from "./expires-at";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("expiresAt", () => {
  test("should resolve", () => {
    expect(expiresAt("10 minutes")).toBe(1609488600);
  });
});
