import { coerceReadValue, coerceWriteValue } from "./coerce-value.js";
import { describe, expect, test } from "vitest";

describe("coerceReadValue", () => {
  test("should return null for null", () => {
    expect(coerceReadValue(null, "string")).toBeNull();
  });

  test("should return undefined for undefined", () => {
    expect(coerceReadValue(undefined, "string")).toBeUndefined();
  });

  test("should coerce bigint string to BigInt", () => {
    expect(coerceReadValue("9007199254740993", "bigint")).toBe(
      BigInt("9007199254740993"),
    );
  });

  test("should pass through BigInt for bigint type", () => {
    expect(coerceReadValue(BigInt(42), "bigint")).toBe(BigInt(42));
  });

  test("should coerce decimal string to number", () => {
    expect(coerceReadValue("3.14", "decimal")).toBe(3.14);
  });

  test("should coerce float string to number", () => {
    expect(coerceReadValue("2.71828", "float")).toBe(2.71828);
  });

  test("should coerce real string to number", () => {
    expect(coerceReadValue("1.5", "real")).toBe(1.5);
  });

  test("should coerce integer string to number", () => {
    expect(coerceReadValue("42", "integer")).toBe(42);
  });

  test("should coerce smallint string to number", () => {
    expect(coerceReadValue("7", "smallint")).toBe(7);
  });

  test("should pass through number for integer type", () => {
    expect(coerceReadValue(42, "integer")).toBe(42);
  });

  test("should pass through string for string type", () => {
    expect(coerceReadValue("hello", "string")).toBe("hello");
  });

  test("should pass through boolean", () => {
    expect(coerceReadValue(true, "boolean")).toBe(true);
  });

  test("should pass through for null type", () => {
    expect(coerceReadValue("hello", null)).toBe("hello");
  });
});

describe("coerceWriteValue", () => {
  test("should return null for null", () => {
    expect(coerceWriteValue(null)).toBeNull();
  });

  test("should return undefined for undefined", () => {
    expect(coerceWriteValue(undefined)).toBeUndefined();
  });

  test("should convert BigInt to string", () => {
    expect(coerceWriteValue(BigInt("9007199254740993"))).toBe("9007199254740993");
  });

  test("should pass through number", () => {
    expect(coerceWriteValue(42)).toBe(42);
  });

  test("should pass through string", () => {
    expect(coerceWriteValue("hello")).toBe("hello");
  });

  test("should pass through Date", () => {
    const date = new Date();
    expect(coerceWriteValue(date)).toBe(date);
  });
});
