import { removeUndefinedFromArray, removeUndefinedFromObject } from "./remove-undefined";

describe("removeUndefinedFromObject", () => {
  test("should remove undefined values from object", () => {
    expect(
      removeUndefinedFromObject({
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
      three: null,
      five: "",
      six: 0,
    });
  });
});

describe("removeUndefinedFromArray", () => {
  test("should remove undefined values from array", () => {
    expect(removeUndefinedFromArray(["one", 2, null, undefined, "", 0])).toStrictEqual([
      "one",
      2,
      null,
      "",
      0,
    ]);
  });
});
