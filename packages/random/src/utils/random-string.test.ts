import { describe, expect, test } from "vitest";
import { randomString } from "./random-string.js";

describe("randomString", () => {
  test("should default to alphanumeric and respect length", () => {
    const result = randomString(32);
    expect(result.length).toEqual(32);
    expect(result).toMatch(/^[A-Za-z0-9]+$/);
  });

  test.each([
    ["alpha", /^[A-Za-z]+$/],
    ["alphanumeric", /^[A-Za-z0-9]+$/],
    ["base64url", /^[A-Za-z0-9_-]+$/],
    ["hex", /^[0-9a-f]+$/],
    ["lower", /^[a-z]+$/],
    ["numeric", /^[0-9]+$/],
    ["unreserved", /^[A-Za-z0-9._~-]+$/],
    ["unambiguous", /^[A-HJ-KM-NP-Z2-9]+$/],
    ["upper", /^[A-Z]+$/],
  ] as const)("preset %s should produce only valid characters", (alphabet, pattern) => {
    const result = randomString(64, alphabet);
    expect(result.length).toEqual(64);
    expect(result).toMatch(pattern);
  });

  test("should return empty string for length 0", () => {
    expect(randomString(0)).toEqual("");
  });

  test("should throw on negative length", () => {
    expect(() => randomString(-1)).toThrow("length must be non-negative");
  });
});
