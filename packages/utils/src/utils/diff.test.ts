import { diff } from "./diff";

describe("diff", () => {
  test("should return true if all elements are in source", () => {
    expect(diff([1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5])).toEqual(true);
  });

  test("should return false if not all elements are in source", () => {
    expect(diff([1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 10])).toEqual(false);
  });
});
