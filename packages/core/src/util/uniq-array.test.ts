import { uniqArray } from "./uniq-array";

describe("uniqArray", () => {
  test("should resolve", () => {
    expect(
      uniqArray("one", "two", ["three"], [["four", "five"], "six"], "seven", [[["eight"]]]),
    ).toStrictEqual(["eight", "five", "four", "one", "seven", "six", "three", "two"]);
  });
});
