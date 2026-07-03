import { describe, expect, test } from "vitest";
import { stringifyForStorage } from "./stringify-for-storage.js";

describe("stringifyForStorage", () => {
  test("should stringify a bigint array as decimal strings instead of throwing", () => {
    expect(stringifyForStorage([1n, 9007199254740993n])).toBe('["1","9007199254740993"]');
  });

  test("should not throw on a nested bigint", () => {
    expect(() => stringifyForStorage({ v: 5n })).not.toThrow();
    expect(stringifyForStorage({ v: 5n })).toBe('{"v":"5"}');
  });

  test("should serialise Dates to ISO strings (native JSON behaviour)", () => {
    expect(stringifyForStorage([new Date("2024-01-15T12:00:00.000Z")])).toBe(
      '["2024-01-15T12:00:00.000Z"]',
    );
  });

  test("should match JSON.stringify for bigint-free values", () => {
    const value = { a: 1, b: ["x", true, null], c: 2.5 };
    expect(stringifyForStorage(value)).toBe(JSON.stringify(value));
  });
});
