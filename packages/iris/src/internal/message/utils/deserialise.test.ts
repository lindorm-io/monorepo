import { IrisSerializationError } from "../../../errors/IrisSerializationError";
import { deserialise } from "./deserialise";
import { describe, expect, it } from "vitest";

describe("deserialise", () => {
  describe("bigint", () => {
    it("should return bigint when already bigint", () => {
      expect(deserialise(BigInt(42), "bigint")).toMatchSnapshot();
    });

    it("should convert numeric string to bigint", () => {
      expect(deserialise("123", "bigint")).toMatchSnapshot();
    });

    it("should convert number to bigint", () => {
      expect(deserialise(99, "bigint")).toMatchSnapshot();
    });

    it("should return null for null input", () => {
      expect(deserialise(null, "bigint")).toMatchSnapshot();
    });

    it("should return null for undefined input", () => {
      expect(deserialise(undefined, "bigint")).toMatchSnapshot();
    });

    it("should throw for non-numeric string", () => {
      expect(() => deserialise("not-a-number", "bigint")).toThrow(IrisSerializationError);
    });
  });

  describe("boolean", () => {
    it("should return boolean when already boolean true", () => {
      expect(deserialise(true, "boolean")).toMatchSnapshot();
    });

    it("should return boolean when already boolean false", () => {
      expect(deserialise(false, "boolean")).toMatchSnapshot();
    });

    it("should return null for null input", () => {
      expect(deserialise(null, "boolean")).toMatchSnapshot();
    });

    it("should return null for undefined input", () => {
      expect(deserialise(undefined, "boolean")).toMatchSnapshot();
    });

    it("should convert string 'true' to true", () => {
      expect(deserialise("true", "boolean")).toMatchSnapshot();
    });

    it("should convert string 'false' to false", () => {
      expect(deserialise("false", "boolean")).toMatchSnapshot();
    });

    it("should convert number 1 to true", () => {
      expect(deserialise(1, "boolean")).toMatchSnapshot();
    });

    it("should convert number 0 to false", () => {
      expect(deserialise(0, "boolean")).toMatchSnapshot();
    });

    it("should convert non-empty string to true via Boolean()", () => {
      expect(deserialise("anything", "boolean")).toMatchSnapshot();
    });
  });

  describe("date", () => {
    const fixedDate = new Date("2024-06-15T12:00:00.000Z");

    it("should return Date when already a valid Date", () => {
      expect(deserialise(fixedDate, "date")).toMatchSnapshot();
    });

    it("should throw for invalid Date object", () => {
      expect(() => deserialise(new Date("invalid"), "date")).toThrow(
        IrisSerializationError,
      );
    });

    it("should return null for null input", () => {
      expect(deserialise(null, "date")).toMatchSnapshot();
    });

    it("should return null for undefined input", () => {
      expect(deserialise(undefined, "date")).toMatchSnapshot();
    });

    it("should convert ISO string to Date", () => {
      const result = deserialise("2024-06-15T12:00:00.000Z", "date");
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toMatchSnapshot();
    });

    it("should convert numeric timestamp to Date", () => {
      const result = deserialise(1718452800000, "date");
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toMatchSnapshot();
    });

    it("should throw for invalid string", () => {
      expect(() => deserialise("not-a-date", "date")).toThrow(IrisSerializationError);
    });
  });

  describe("float", () => {
    it("should return number when already a number", () => {
      expect(deserialise(3.14, "float")).toMatchSnapshot();
    });

    it("should return integer number as-is", () => {
      expect(deserialise(42, "float")).toMatchSnapshot();
    });

    it("should return null for null input", () => {
      expect(deserialise(null, "float")).toMatchSnapshot();
    });

    it("should return null for undefined input", () => {
      expect(deserialise(undefined, "float")).toMatchSnapshot();
    });

    it("should convert string number to float", () => {
      expect(deserialise("3.14", "float")).toMatchSnapshot();
    });

    it("should throw for non-numeric string", () => {
      expect(() => deserialise("not-a-number", "float")).toThrow(IrisSerializationError);
    });
  });

  describe("integer", () => {
    it("should return integer when already an integer", () => {
      expect(deserialise(42, "integer")).toMatchSnapshot();
    });

    it("should truncate float to integer", () => {
      expect(deserialise(3.99, "integer")).toMatchSnapshot();
    });

    it("should return null for null input", () => {
      expect(deserialise(null, "integer")).toMatchSnapshot();
    });

    it("should return null for undefined input", () => {
      expect(deserialise(undefined, "integer")).toMatchSnapshot();
    });

    it("should convert string number to integer", () => {
      expect(deserialise("42", "integer")).toMatchSnapshot();
    });

    it("should parse string float as integer (parseInt behaviour)", () => {
      expect(deserialise("3.99", "integer")).toMatchSnapshot();
    });

    it("should throw for non-numeric string", () => {
      expect(() => deserialise("not-a-number", "integer")).toThrow(
        IrisSerializationError,
      );
    });
  });

  describe("array", () => {
    it("should return array when already an array", () => {
      expect(deserialise([1, 2, 3], "array")).toMatchSnapshot();
    });

    it("should parse JSON string to array", () => {
      expect(deserialise("[1, 2, 3]", "array")).toMatchSnapshot();
    });

    it("should passthrough null (no null guard)", () => {
      expect(deserialise(null, "array")).toMatchSnapshot();
    });

    it("should passthrough undefined (no null guard)", () => {
      expect(deserialise(undefined, "array")).toMatchSnapshot();
    });

    it("should throw for invalid JSON string", () => {
      expect(() => deserialise("{bad json", "array")).toThrow(IrisSerializationError);
    });

    it("should passthrough non-string non-array values", () => {
      expect(deserialise(42, "array")).toMatchSnapshot();
    });
  });

  describe("object", () => {
    it("should return object when already an object", () => {
      expect(deserialise({ a: 1 }, "object")).toMatchSnapshot();
    });

    it("should parse JSON string to object", () => {
      expect(deserialise('{"a": 1}', "object")).toMatchSnapshot();
    });

    it("should passthrough null (no null guard)", () => {
      expect(deserialise(null, "object")).toMatchSnapshot();
    });

    it("should passthrough undefined (no null guard)", () => {
      expect(deserialise(undefined, "object")).toMatchSnapshot();
    });

    it("should throw for invalid JSON string", () => {
      expect(() => deserialise("{bad json", "object")).toThrow(IrisSerializationError);
    });

    it("should passthrough non-string non-object values", () => {
      expect(deserialise(42, "object")).toMatchSnapshot();
    });
  });

  describe("email", () => {
    it("should return string for string input", () => {
      expect(deserialise("user@example.com", "email")).toMatchSnapshot();
    });

    it("should return null for null input", () => {
      expect(deserialise(null, "email")).toMatchSnapshot();
    });

    it("should return null for undefined input", () => {
      expect(deserialise(undefined, "email")).toMatchSnapshot();
    });

    it("should convert number to string", () => {
      expect(deserialise(42, "email")).toMatchSnapshot();
    });
  });

  describe("string", () => {
    it("should return string when already a string", () => {
      expect(deserialise("hello", "string")).toMatchSnapshot();
    });

    it("should return null for null input", () => {
      expect(deserialise(null, "string")).toMatchSnapshot();
    });

    it("should return null for undefined input", () => {
      expect(deserialise(undefined, "string")).toMatchSnapshot();
    });

    it("should convert number to string", () => {
      expect(deserialise(42, "string")).toMatchSnapshot();
    });

    it("should convert boolean to string", () => {
      expect(deserialise(true, "string")).toMatchSnapshot();
    });
  });

  describe("url", () => {
    it("should return string for string input", () => {
      expect(deserialise("https://example.com", "url")).toMatchSnapshot();
    });

    it("should return null for null input", () => {
      expect(deserialise(null, "url")).toMatchSnapshot();
    });

    it("should return null for undefined input", () => {
      expect(deserialise(undefined, "url")).toMatchSnapshot();
    });

    it("should convert number to string", () => {
      expect(deserialise(123, "url")).toMatchSnapshot();
    });
  });

  describe("uuid", () => {
    it("should return string for string input", () => {
      expect(
        deserialise("550e8400-e29b-41d4-a716-446655440000", "uuid"),
      ).toMatchSnapshot();
    });

    it("should return null for null input", () => {
      expect(deserialise(null, "uuid")).toMatchSnapshot();
    });

    it("should return null for undefined input", () => {
      expect(deserialise(undefined, "uuid")).toMatchSnapshot();
    });

    it("should convert number to string", () => {
      expect(deserialise(42, "uuid")).toMatchSnapshot();
    });
  });

  describe("enum", () => {
    it("should passthrough string value", () => {
      expect(deserialise("active", "enum")).toMatchSnapshot();
    });

    it("should passthrough number value", () => {
      expect(deserialise(1, "enum")).toMatchSnapshot();
    });

    it("should passthrough null", () => {
      expect(deserialise(null, "enum")).toMatchSnapshot();
    });

    it("should passthrough undefined", () => {
      expect(deserialise(undefined, "enum")).toMatchSnapshot();
    });
  });
});
