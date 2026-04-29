import { encodePkSegment } from "./encode-pk-segment.js";
import { describe, expect, test } from "vitest";

describe("encodePkSegment", () => {
  test("should pass through simple string", () => {
    expect(encodePkSegment("hello")).toMatchSnapshot();
  });

  test("should encode string containing colon", () => {
    expect(encodePkSegment("foo:bar")).toMatchSnapshot();
  });

  test("should encode string with multiple colons", () => {
    expect(encodePkSegment("a:b:c")).toMatchSnapshot();
  });

  test("should convert number to string", () => {
    expect(encodePkSegment(42)).toMatchSnapshot();
  });

  test("should convert boolean to string", () => {
    expect(encodePkSegment(true)).toMatchSnapshot();
  });

  test("should handle empty string", () => {
    expect(encodePkSegment("")).toMatchSnapshot();
  });

  test("should handle null", () => {
    expect(() => encodePkSegment(null)).toThrow(
      "PK segment value must not be null or undefined",
    );
  });

  test("should handle undefined", () => {
    expect(() => encodePkSegment(undefined)).toThrow(
      "PK segment value must not be null or undefined",
    );
  });

  test("should handle UUID without encoding (no colons)", () => {
    expect(encodePkSegment("550e8400-e29b-41d4-a716-446655440000")).toMatchSnapshot();
  });
});
