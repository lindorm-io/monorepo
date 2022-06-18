import { removeEmptyFromArray, removeEmptyFromObject } from "./remove-empty";

describe("removeEmptyFromObject", () => {
  test("should remove undefined values from object", () => {
    expect(
      removeEmptyFromObject({
        one: "one",
        two: 2,
        three: null,
        four: undefined,
        five: "",
        six: 0,
      }),
    ).toStrictEqual({
      one: "one",
      two: 2,
      six: 0,
    });
  });
});

describe("removeEmptyFromArray", () => {
  test("should remove undefined values from array", () => {
    expect(removeEmptyFromArray(["one", 2, null, undefined, "", 0])).toStrictEqual(["one", 2, 0]);
  });
});
