import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isTypedArray } from "./is-typed-array.js";
import { describe, expect, test } from "vitest";

describe("isTypedArray", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isTypedArray(value)).toMatchSnapshot();
  });

  test.each([
    ["Int8Array", new Int8Array([1])],
    ["Uint8Array", new Uint8Array([1])],
    ["Uint8ClampedArray", new Uint8ClampedArray([1])],
    ["Int16Array", new Int16Array([1])],
    ["Uint16Array", new Uint16Array([1])],
    ["Int32Array", new Int32Array([1])],
    ["Uint32Array", new Uint32Array([1])],
    ["Float32Array", new Float32Array([1.5])],
    ["Float64Array", new Float64Array([1.5])],
    ["BigInt64Array", new BigInt64Array([1n])],
    ["BigUint64Array", new BigUint64Array([1n])],
    // Buffer extends Uint8Array, so the typed-array guard subsumes `isBuffer`.
    ["Buffer", Buffer.from("test")],
  ])("should accept %s", (_, value) => {
    expect(isTypedArray(value)).toBe(true);
  });

  test("should reject anything else", () => {
    expect(isTypedArray(new DataView(new ArrayBuffer(8)))).toBe(false);
    expect(isTypedArray(new ArrayBuffer(8))).toBe(false);
    expect(isTypedArray([1, 2, 3])).toBe(false);
    expect(isTypedArray({})).toBe(false);
    expect(isTypedArray(null)).toBe(false);
  });
});
