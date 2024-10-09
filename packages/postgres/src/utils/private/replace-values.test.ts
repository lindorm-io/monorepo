import { replaceValues } from "./replace-values";

describe("replaceValues", () => {
  test("should return empty values", () => {
    expect(replaceValues([], true)).toEqual([]);
  });

  test("should return unedited values", () => {
    expect(replaceValues([{ unedited: true }], false)).toEqual([{ unedited: true }]);
  });

  test("should return complex stringified object values", () => {
    expect(replaceValues([{ complex: { object: true } }], true)).toEqual([
      '{"__meta__":{"complex":{"object":"B"}},"__record__":{"complex":{"object":"true"}}}',
    ]);
  });

  test("should return stringified array values", () => {
    expect(replaceValues([["array"]], true)).toEqual(['["array"]']);
  });
});
