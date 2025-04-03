import { diff, diffAny } from "./diff";

describe("diff", () => {
  test("should return an empty array if all elements are in source", () => {
    expect(diff([1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5])).toEqual([]);
  });

  test("should return array of items if not all elements are in source", () => {
    expect(diff([1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 10])).toEqual([10]);
  });

  test("should return array of items in complex object array", () => {
    expect(
      diff([{ test: 1 }, { test: 2 }, { test: 3 }], [{ test: 1 }, { test: 4 }]),
    ).toEqual([{ test: 4 }]);
  });

  test("should return array of all items not equal in source or target", () => {
    expect(diffAny([1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 10])).toEqual([
      10, 6, 7, 8, 9,
    ]);
  });
});
