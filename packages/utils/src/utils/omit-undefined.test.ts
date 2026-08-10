import { describe, expect, test } from "vitest";
import { omitUndefined } from "./omit-undefined.js";

describe("omitUndefined", () => {
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
    expect(omitUndefined(testArray)).toMatchSnapshot();
  });

  test("should remove empty from object", () => {
    expect(omitUndefined(testObject)).toMatchSnapshot();
  });

  test("should preserve built-in exotic objects nested in an object", () => {
    const regExp = /^cookie/;
    const set = new Set([1, 2]);
    const map = new Map([["a", 1]]);
    const bytes = new Uint8Array([1, 2, 3]);
    const buffer = Buffer.from("test");
    const url = new URL("https://test.lindorm.io");
    const arrayBuffer = new ArrayBuffer(8);
    const dataView = new DataView(arrayBuffer);

    const result = omitUndefined({
      purpose: { $regex: regExp },
      seen: set,
      index: map,
      bytes,
      buffer,
      url,
      arrayBuffer,
      dataView,
      gone: undefined,
    });

    expect(result.purpose.$regex).toBe(regExp);
    expect(result.seen).toBe(set);
    expect(result.index).toBe(map);
    expect(result.bytes).toBe(bytes);
    expect(result.buffer).toBe(buffer);
    expect(result.url).toBe(url);
    expect(result.arrayBuffer).toBe(arrayBuffer);
    expect(result.dataView).toBe(dataView);
    expect(result).not.toHaveProperty("gone");
  });

  test("should preserve built-in exotic objects nested in an array", () => {
    const regExp = /^cookie/;
    const set = new Set([1, 2]);
    const map = new Map([["a", 1]]);

    const result = omitUndefined([regExp, set, map, undefined]);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe(regExp);
    expect(result[1]).toBe(set);
    expect(result[2]).toBe(map);
  });
});
