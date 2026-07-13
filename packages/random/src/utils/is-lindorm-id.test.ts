import { isLindormId } from "./is-lindorm-id.js";
import { LINDORM_ID_PATTERN } from "./lindorm-id-pattern.js";
import { randomId, type RandomIdLength } from "./random-id.js";
import { randomUUID } from "./random-uuid.js";
import { describe, expect, test } from "vitest";

// Every length the generator can mint. Typed as RandomIdLength so the list cannot
// silently fall behind the union.
const LENGTHS: Array<RandomIdLength> = [
  16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64,
];

describe("isLindormId", () => {
  test("should pin the derived pattern", () => {
    expect(LINDORM_ID_PATTERN.source).toMatchSnapshot();
  });

  test("should accept a real bare id", () => {
    for (let i = 0; i < 100; i++) {
      expect(isLindormId(randomId())).toBe(true);
    }
  });

  test("should accept a real namespaced id", () => {
    for (let i = 0; i < 100; i++) {
      expect(isLindormId(randomId("client"))).toBe(true);
    }
  });

  test.each(LENGTHS)("should accept a real id of length %i", (length) => {
    expect(isLindormId(randomId({ length }))).toBe(true);
    expect(isLindormId(randomId({ namespace: "Ns0", length }))).toBe(true);
  });

  test("should reject a body below the minimum length", () => {
    expect(isLindormId("a".repeat(15))).toBe(false);
    expect(isLindormId(`client_${"a".repeat(15)}`)).toBe(false);
  });

  test("should reject a body above the maximum length", () => {
    expect(isLindormId("a".repeat(65))).toBe(false);
    expect(isLindormId(`client_${"a".repeat(65)}`)).toBe(false);
  });

  test.each([
    "abcdefghijklmnop-qrst",
    "abcdefghijklmnop!qrst",
    "abcdefghijklmnop.qrst",
    "client_abcdefghijklmnop-qrst",
  ])("should reject non-base62 characters: %j", (value) => {
    expect(isLindormId(value)).toBe(false);
  });

  test("should reject a double underscore", () => {
    expect(isLindormId(`client__${"a".repeat(24)}`)).toBe(false);
  });

  test("should reject an empty namespace", () => {
    expect(isLindormId(`_${"a".repeat(24)}`)).toBe(false);
  });

  test("should reject a uuid", () => {
    expect(isLindormId(randomUUID())).toBe(false);
  });

  test("should reject an empty string", () => {
    expect(isLindormId("")).toBe(false);
  });

  test("should reject a non-string value", () => {
    expect(isLindormId(null)).toBe(false);
    expect(isLindormId(undefined)).toBe(false);
    expect(isLindormId(1)).toBe(false);
    expect(isLindormId(true)).toBe(false);
    expect(isLindormId({})).toBe(false);
    expect(isLindormId([])).toBe(false);
    expect(isLindormId(Symbol("id"))).toBe(false);
  });
});
