import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isArrayBuffer } from "./is-array-buffer.js";
import { describe, expect, test } from "vitest";

describe("isArrayBuffer", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isArrayBuffer(value)).toMatchSnapshot();
  });

  test("should accept array buffers", () => {
    expect(isArrayBuffer(new ArrayBuffer(8))).toBe(true);
    expect(isArrayBuffer(new Uint8Array([1, 2]).buffer)).toBe(true);
  });

  test("should reject anything else", () => {
    expect(isArrayBuffer(new SharedArrayBuffer(8))).toBe(false);
    expect(isArrayBuffer(new Uint8Array([1]))).toBe(false);
    expect(isArrayBuffer(new DataView(new ArrayBuffer(8)))).toBe(false);
    expect(isArrayBuffer({})).toBe(false);
    expect(isArrayBuffer(null)).toBe(false);
  });
});
