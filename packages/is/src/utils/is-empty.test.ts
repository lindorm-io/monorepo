import { TEST_FIXTURES } from "../__fixtures__/test-fixtures.js";
import { isEmpty } from "./is-empty.js";
import { describe, expect, test } from "vitest";

describe("isEmpty", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isEmpty(value)).toMatchSnapshot();
  });

  // `Map` and `Set` keep their entries where `Object.entries` cannot see them,
  // so emptiness is read from `size`. They are the only exotics with an
  // unambiguous notion of it.
  test.each([
    ["empty Map", new Map(), true],
    ["Map with entries", new Map([["a", 1]]), false],
    ["empty Set", new Set(), true],
    ["Set with entries", new Set([1]), false],
  ])("should read emptiness of %s from size", (_, value, expected) => {
    expect(isEmpty(value)).toBe(expected);
  });

  // Everything else exotic stays opaque and reports `false`. "Is this
  // ArrayBuffer empty?" means `byteLength === 0`, a different enough question
  // that answering it silently would be worse than not answering.
  test.each([
    ["RegExp", /test/i],
    ["Uint8Array", new Uint8Array([])],
    ["Buffer", Buffer.alloc(0)],
    ["ArrayBuffer", new ArrayBuffer(0)],
    ["WeakMap", new WeakMap()],
    ["WeakSet", new WeakSet()],
  ])("should report built-in exotic object %s as not empty", (_, value) => {
    expect(isEmpty(value)).toBe(false);
  });

  test("should report plain containers as empty", () => {
    expect(isEmpty({})).toBe(true);
    expect(isEmpty(Object.create(null))).toBe(true);
    expect(isEmpty([])).toBe(true);
    expect(isEmpty("")).toBe(true);
  });
});
