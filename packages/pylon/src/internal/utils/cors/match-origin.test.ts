import { matchOrigin } from "./match-origin";
import { describe, expect, test } from "vitest";

describe("matchOrigin", () => {
  test("should return false for missing origin", () => {
    expect(matchOrigin(undefined, ["https://app.example.com"])).toBe(false);
  });

  test("should return true for wildcard allow list", () => {
    expect(matchOrigin("https://app.example.com", "*")).toBe(true);
  });

  test("should return true for exact match", () => {
    expect(matchOrigin("https://app.example.com", ["https://app.example.com"])).toBe(
      true,
    );
  });

  test("should normalize trailing slashes", () => {
    expect(matchOrigin("https://app.example.com/", ["https://app.example.com"])).toBe(
      true,
    );
    expect(matchOrigin("https://app.example.com", ["https://app.example.com/"])).toBe(
      true,
    );
  });

  test("should normalize case", () => {
    expect(matchOrigin("https://App.Example.com", ["https://app.example.com"])).toBe(
      true,
    );
  });

  test("should return false for non-match", () => {
    expect(matchOrigin("https://evil.example.com", ["https://app.example.com"])).toBe(
      false,
    );
  });

  test("should return false when allow list is empty", () => {
    expect(matchOrigin("https://app.example.com", [])).toBe(false);
  });

  test("should return false when allow list is undefined", () => {
    expect(matchOrigin("https://app.example.com", undefined)).toBe(false);
  });
});
