import { sortObjectKeys } from "./sort-object-keys";

describe("sortObjectKeys", () => {
  test("should sort keys on object", () => {
    expect(
      JSON.stringify(
        sortObjectKeys({
          zz: "zz",
          xx: "xx",
          a: [],
          yy: 123,
          aa: "a",
          bb: { a: 1, b: 2, c: 3 },
        }),
      ),
    ).toBe('{"a":[],"aa":"a","bb":{"a":1,"b":2,"c":3},"xx":"xx","yy":123,"zz":"zz"}');
  });
});
