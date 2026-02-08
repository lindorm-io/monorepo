import { reverseDictValues } from "./reverse-dict-values";

describe("reverseDictValues", () => {
  test("should reverse dict key-value pairs", () => {
    expect(reverseDictValues({ customOneId: "id" })).toEqual({ id: "customOneId" });
  });

  test("should reverse composite key mapping", () => {
    expect(reverseDictValues({ twoFirst: "first", twoSecond: "second" })).toEqual({
      first: "twoFirst",
      second: "twoSecond",
    });
  });

  test("should return empty object for empty input", () => {
    expect(reverseDictValues({})).toEqual({});
  });
});
