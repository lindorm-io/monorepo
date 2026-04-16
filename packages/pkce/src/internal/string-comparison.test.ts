import { stringComparison } from "./string-comparison";

describe("stringComparison", () => {
  test("returns true", () => {
    expect(stringComparison("one", "one")).toEqual(true);
  });

  test("returns false", () => {
    expect(stringComparison("very-long-string", "short-string")).toEqual(false);
  });
});
