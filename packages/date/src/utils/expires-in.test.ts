import MockDate from "mockdate";
import { expiresIn } from "./expires-in";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("expiresIn", () => {
  test("should resolve", () => {
    expect(expiresIn("10 minutes")).toEqual(600);
  });
});
