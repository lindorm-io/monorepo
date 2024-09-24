import MockDate from "mockdate";
import { expiresIn } from "./expires-in";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("expiresIn", () => {
  test("should resolve", () => {
    expect(expiresIn("10 minutes")).toEqual(600);
  });
});
