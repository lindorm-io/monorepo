import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isSharedArrayBuffer } from "./is-shared-array-buffer.js";
import { describe, expect, test } from "vitest";

describe("isSharedArrayBuffer", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isSharedArrayBuffer(value)).toMatchSnapshot();
  });

  test("should accept shared array buffers", () => {
    expect(isSharedArrayBuffer(new SharedArrayBuffer(8))).toBe(true);
  });

  test("should reject anything else", () => {
    expect(isSharedArrayBuffer(new ArrayBuffer(8))).toBe(false);
    expect(isSharedArrayBuffer(new Uint8Array([1]))).toBe(false);
    expect(isSharedArrayBuffer({})).toBe(false);
    expect(isSharedArrayBuffer(null)).toBe(false);
  });
});
