import { deserialise } from "./deserialise";
import { describe, expect, test } from "vitest";

describe("deserialise", () => {
  describe("bigint", () => {
    test("should return bigint as-is", () => {
      expect(deserialise(42n, "bigint")).toBe(42n);
    });

    test("should convert number string to bigint", () => {
      expect(deserialise("100", "bigint")).toBe(100n);
    });

    test("should return null for null", () => {
      expect(deserialise(null, "bigint")).toBeNull();
    });

    test("should return null for undefined", () => {
      expect(deserialise(undefined, "bigint")).toBeNull();
    });

    test("should convert integer to bigint", () => {
      expect(deserialise(99, "bigint")).toBe(99n);
    });
  });

  describe("boolean", () => {
    test("should return boolean as-is when true", () => {
      expect(deserialise(true, "boolean")).toBe(true);
    });

    test("should return boolean as-is when false", () => {
      expect(deserialise(false, "boolean")).toBe(false);
    });

    test("should convert string 'true' to true", () => {
      expect(deserialise("true", "boolean")).toBe(true);
    });

    test("should convert string 'false' to false", () => {
      expect(deserialise("false", "boolean")).toBe(false);
    });

    test("should convert 1 to true", () => {
      expect(deserialise(1, "boolean")).toBe(true);
    });

    test("should convert 0 to false", () => {
      expect(deserialise(0, "boolean")).toBe(false);
    });
  });

  describe("date", () => {
    test("should return valid Date as-is", () => {
      const date = new Date("2024-01-15T12:00:00Z");
      expect(deserialise(date, "date")).toBe(date);
    });

    test("should throw for invalid Date object", () => {
      expect(() => deserialise(new Date("invalid"), "date")).toThrow(
        "Invalid Date object",
      );
    });

    test("should return null for null input", () => {
      expect(deserialise(null, "date")).toBeNull();
    });

    test("should parse ISO string to Date", () => {
      const result = deserialise("2024-01-15T12:00:00Z", "date");
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe("2024-01-15T12:00:00.000Z");
    });

    test("should throw for unparseable string", () => {
      expect(() => deserialise("not-a-date", "date")).toThrow(
        "Cannot convert value to date",
      );
    });
  });

  describe("timestamp", () => {
    test("should return valid Date as-is", () => {
      const date = new Date("2024-06-01T00:00:00Z");
      expect(deserialise(date, "timestamp")).toBe(date);
    });

    test("should parse ISO string to Date", () => {
      const result = deserialise("2024-06-01T00:00:00Z", "timestamp");
      expect(result).toBeInstanceOf(Date);
    });

    test("should return null for null input", () => {
      expect(deserialise(null, "timestamp")).toBeNull();
    });
  });

  describe("float", () => {
    test("should return number as-is", () => {
      expect(deserialise(3.14, "float")).toBe(3.14);
    });

    test("should return null for null", () => {
      expect(deserialise(null, "float")).toBeNull();
    });

    test("should parse float string", () => {
      expect(deserialise("2.718", "float")).toBe(2.718);
    });

    test("should throw for non-numeric string", () => {
      expect(() => deserialise("abc", "float")).toThrow("Cannot convert value to float");
    });
  });

  describe("real", () => {
    test("should return number as-is", () => {
      expect(deserialise(1.5, "real")).toBe(1.5);
    });

    test("should return null for null", () => {
      expect(deserialise(null, "real")).toBeNull();
    });

    test("should parse float string", () => {
      expect(deserialise("9.99", "real")).toBe(9.99);
    });
  });

  describe("integer", () => {
    test("should return integer as-is", () => {
      expect(deserialise(42, "integer")).toBe(42);
    });

    test("should truncate float to integer", () => {
      expect(deserialise(3.9, "integer")).toBe(3);
    });

    test("should return null for null", () => {
      expect(deserialise(null, "integer")).toBeNull();
    });

    test("should parse integer string", () => {
      expect(deserialise("123", "integer")).toBe(123);
    });

    test("should throw for non-numeric string", () => {
      expect(() => deserialise("xyz", "integer")).toThrow(
        "Cannot convert value to integer",
      );
    });
  });

  describe("smallint", () => {
    test("should return integer as-is", () => {
      expect(deserialise(7, "smallint")).toBe(7);
    });

    test("should return null for null", () => {
      expect(deserialise(null, "smallint")).toBeNull();
    });

    test("should parse integer string", () => {
      expect(deserialise("55", "smallint")).toBe(55);
    });
  });

  describe("decimal", () => {
    test("should return string as-is", () => {
      expect(deserialise("123.456", "decimal")).toBe("123.456");
    });

    test("should return null for null", () => {
      expect(deserialise(null, "decimal")).toBeNull();
    });

    test("should convert number to string", () => {
      expect(deserialise(42, "decimal")).toBe("42");
    });
  });

  describe("array", () => {
    test("should return array as-is", () => {
      const arr = [1, 2, 3];
      expect(deserialise(arr, "array")).toBe(arr);
    });

    test("should parse JSON string to array", () => {
      expect(deserialise('["a","b"]', "array")).toEqual(["a", "b"]);
    });
  });

  describe("object", () => {
    test("should return object as-is", () => {
      const obj = { foo: "bar" };
      expect(deserialise(obj, "object")).toBe(obj);
    });

    test("should parse JSON string to object", () => {
      expect(deserialise('{"key":"value"}', "object")).toEqual({ key: "value" });
    });
  });

  describe("json", () => {
    test("should return object as-is", () => {
      const obj = { a: 1 };
      expect(deserialise(obj, "json")).toBe(obj);
    });

    test("should parse JSON string", () => {
      expect(deserialise('{"x":42}', "json")).toEqual({ x: 42 });
    });
  });

  describe("null type (passthrough)", () => {
    test("should return value as-is for null type", () => {
      expect(deserialise("anything", null)).toBe("anything");
    });

    test("should return undefined for unknown type", () => {
      expect(deserialise(undefined, null)).toBeUndefined();
    });
  });

  describe("default/passthrough types", () => {
    test("should return string value for uuid type", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      expect(deserialise(uuid, "uuid")).toBe(uuid);
    });

    test("should return string value for string type", () => {
      expect(deserialise("hello", "string")).toBe("hello");
    });
  });
});
