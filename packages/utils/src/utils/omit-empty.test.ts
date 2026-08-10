import { describe, expect, test } from "vitest";
import { omitEmpty } from "./omit-empty.js";

describe("omitEmpty", () => {
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
      [
        1,
        2,
        3,
        4,
        null,
        undefined,
        "",
        {},
        { a: 1, b: {}, c: null, d: undefined, f: "", h: [] },
      ],
    ],
  };

  test("should remove empty from array", () => {
    expect(omitEmpty(testArray)).toMatchSnapshot();
  });

  test("should remove empty from object", () => {
    expect(omitEmpty(testObject)).toMatchSnapshot();
  });

  test("should preserve built-in exotic objects nested in an object", () => {
    const regExp = /^cookie/;
    const set = new Set([1, 2]);
    const map = new Map([["a", 1]]);
    const bytes = new Uint8Array([1, 2, 3]);
    const url = new URL("https://test.lindorm.io");

    // An exotic is never REBUILT — it is carried through by reference, exactly
    // like a `Buffer` or a `Date` already was. A `Map`/`Set` is still SUBJECT to
    // the empty test, because `isEmpty` reads its `size`: an empty one is
    // stripped like `[]` and `{}`, a populated one is kept. Everything else is
    // opaque to `isEmpty` and always kept.
    const result = omitEmpty({
      purpose: { $regex: regExp },
      seen: set,
      emptySet: new Set(),
      emptyMap: new Map(),
      index: map,
      bytes,
      url,
      gone: "",
    });

    expect(result.purpose.$regex).toBe(regExp);
    expect(result.seen).toBe(set);
    expect(result.index).toBe(map);
    expect(result.bytes).toBe(bytes);
    expect(result.url).toBe(url);
    expect(result).not.toHaveProperty("emptySet");
    expect(result).not.toHaveProperty("emptyMap");
    expect(result).not.toHaveProperty("gone");
  });
});
