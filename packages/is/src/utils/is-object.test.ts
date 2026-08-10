import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isObject } from "./is-object.js";
import { describe, expect, test } from "vitest";

describe("isObject", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isObject(value)).toMatchSnapshot();
  });

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
  ])("should reject built-in exotic object %s", (_, value) => {
    expect(isObject(value)).toBe(false);
  });

  test("should accept plain data bags", () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ object: true })).toBe(true);
    expect(isObject(Object.create(null))).toBe(true);
    expect(isObject(JSON.parse('{"nested":{"a":1}}'))).toBe(true);
  });
});
