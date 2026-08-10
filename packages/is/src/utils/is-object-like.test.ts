import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isObjectLike } from "./is-object-like.js";
import { describe, expect, test } from "vitest";

describe("isObjectLike", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isObjectLike(value)).toMatchSnapshot();
  });

  // The layering: `isObjectLike` is the BROAD check and keeps answering true for
  // every built-in exotic object; `isObject` is the plain-data-bag check and
  // rejects them. Pinned here because that split is what makes `isObject` safe
  // to recurse into.
  test.each([
    ["RegExp", /test/i],
    ["URL", new URL("https://test.lindorm.io")],
    ["Map", new Map([["a", 1]])],
    ["Set", new Set([1, 2])],
    ["WeakMap", new WeakMap()],
    ["WeakSet", new WeakSet()],
    ["Uint8Array", new Uint8Array([1, 2])],
    ["Float64Array", new Float64Array([1.5])],
    ["BigInt64Array", new BigInt64Array([1n])],
    ["Buffer", Buffer.from("test")],
    ["ArrayBuffer", new ArrayBuffer(8)],
    ["SharedArrayBuffer", new SharedArrayBuffer(8)],
    ["DataView", new DataView(new ArrayBuffer(8))],
  ])("should accept built-in exotic object %s", (_, value) => {
    expect(isObjectLike(value)).toBe(true);
  });
});
