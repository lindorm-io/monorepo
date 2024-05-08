import { removeEmpty } from "./remove-empty";

describe("removeEmpty", () => {
  const testArray = [
    1,
    2,
    3,
    4,
    null,
    undefined,
    "",
    {},
    {
      a: 1,
      b: 2,
      c: null,
      d: undefined,
      e: "",
      f: {},
      g: { a: 1, b: {}, c: null, d: undefined, f: "", h: [] },
    },
    [1, 2, 3, 4, null, undefined, "", {}, { a: 1, b: {} }],
  ];

  const testObject = {
    a: 1,
    b: 2,
    c: null,
    d: undefined,
    e: "",
    f: {},
    g: { a: 1, b: {} },
    h: [
      1,
      2,
      3,
      4,
      null,
      undefined,
      "",
      {},
      { a: 1, b: {} },
      [1, 2, 3, 4, null, undefined, "", {}, { a: 1, b: {}, c: null, d: undefined, f: "", h: [] }],
    ],
  };

  test("should remove empty from array", () => {
    expect(removeEmpty(testArray)).toMatchSnapshot();
  });

  test("should remove empty from object", () => {
    expect(removeEmpty(testObject)).toMatchSnapshot();
  });
});
