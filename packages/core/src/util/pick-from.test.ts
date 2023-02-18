import { pickFrom } from "./pick-from";

describe("pickFrom", () => {
  test("should resolve", () => {
    expect(
      pickFrom(
        ["one", "two", "three", "four", "nine"],
        ["one", "two", "three", "four", "five", "six", "seven", "eight"],
      ),
    ).toStrictEqual(["one", "two", "three", "four"]);
  });
});
