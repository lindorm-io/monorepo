import { stringComparison } from "./string-comparison";

describe("string-comparison.ts", () => {
  test("returns true", () => {
    expect(stringComparison("one", "one")).toBe(true);
  });

  test("returns false", () => {
    expect(stringComparison("very-long-string", "short-string")).toBe(false);
  });
});
