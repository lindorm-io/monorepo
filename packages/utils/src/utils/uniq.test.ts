import { uniq, uniqFlat } from "./uniq";

describe("uniq", () => {
  test("should return unique values", () => {
    expect(uniq([1, 2, 3, 3, 3, 3, 4, 5, 6, 6, 6, 7, 7, 7, 8, 9, 9, 9])).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  test("should return unique values in flat array", () => {
    expect(
      uniqFlat(1, 2, 3, 4, 5, 6, 7, 8, 9, [
        2,
        2,
        3,
        [1, 2, 3, 4, 5, 6, [5, 6, 7, 8, 9, [9, 8, 7, [6, 5, 4, 3, 2, 1]]]],
      ]),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
