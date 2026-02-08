import { Primitive } from "../classes/Primitive";
import { deserialise } from "./deserialise";

describe("deserialise", () => {
  describe("bigint", () => {
    test("should return bigint as-is", () => {
      expect(deserialise(BigInt(42), "bigint")).toBe(BigInt(42));
    });

    test("should convert number to bigint", () => {
      expect(deserialise(42, "bigint")).toBe(BigInt(42));
    });

    test("should convert string to bigint", () => {
      expect(deserialise("9007199254740993", "bigint")).toBe(BigInt("9007199254740993"));
    });

    test("should return BigInt(0) for null", () => {
      expect(deserialise(null, "bigint")).toBe(BigInt(0));
    });

    test("should throw for non-numeric string", () => {
      expect(() => deserialise("abc", "bigint")).toThrow();
    });
  });

  describe("boolean", () => {
    test("should return boolean as-is", () => {
      expect(deserialise(true, "boolean")).toBe(true);
      expect(deserialise(false, "boolean")).toBe(false);
    });

    test("should deserialise string 'true' to true", () => {
      expect(deserialise("true", "boolean")).toBe(true);
    });

    test("should deserialise string 'false' to false", () => {
      expect(deserialise("false", "boolean")).toBe(false);
    });

    test("should deserialise arbitrary string to false", () => {
      expect(deserialise("yes", "boolean")).toBe(false);
    });

    test("should coerce falsy number to false", () => {
      expect(deserialise(0, "boolean")).toBe(false);
    });

    test("should coerce truthy number to true", () => {
      expect(deserialise(1, "boolean")).toBe(true);
    });
  });

  describe("date", () => {
    const now = new Date("2024-01-01T00:00:00.000Z");

    test("should return valid Date as-is", () => {
      expect(deserialise(now, "date")).toEqual(now);
    });

    test("should throw for invalid Date object", () => {
      expect(() => deserialise(new Date("invalid"), "date")).toThrow(
        "Invalid Date object",
      );
    });

    test("should return null/undefined as-is", () => {
      expect(deserialise(null, "date")).toBeNull();
      expect(deserialise(undefined, "date")).toBeUndefined();
    });

    test("should convert ISO string to Date", () => {
      const result = deserialise("2024-01-01T00:00:00.000Z", "date");
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    });

    test("should throw for unconvertible string", () => {
      expect(() => deserialise("not-a-date", "date")).toThrow(
        "Cannot convert value to date",
      );
    });
  });

  describe("float", () => {
    test("should return number as-is", () => {
      expect(deserialise(3.14, "float")).toBeCloseTo(3.14);
    });

    test("should return 0 for null", () => {
      expect(deserialise(null, "float")).toBe(0);
    });

    test("should parse float string", () => {
      expect(deserialise("3.14", "float")).toBeCloseTo(3.14);
    });

    test("should throw for non-numeric string", () => {
      expect(() => deserialise("abc", "float")).toThrow("Cannot convert value to float");
    });
  });

  describe("integer", () => {
    test("should return integer as-is", () => {
      expect(deserialise(42, "integer")).toBe(42);
    });

    test("should truncate float to integer", () => {
      expect(deserialise(3.7, "integer")).toBe(3);
    });

    test("should return 0 for null", () => {
      expect(deserialise(null, "integer")).toBe(0);
    });

    test("should parse integer string", () => {
      expect(deserialise("42", "integer")).toBe(42);
    });

    test("should throw for non-numeric string", () => {
      expect(() => deserialise("abc", "integer")).toThrow(
        "Cannot convert value to integer",
      );
    });
  });

  describe("array", () => {
    test("should return non-string value as-is", () => {
      const arr = [1, 2, 3];
      expect(deserialise(arr, "array")).toBe(arr);
    });

    test("should round-trip simple string array", () => {
      const original = ["a", "b", "c"];
      const serialised = new Primitive(original).toString();
      expect(deserialise(serialised, "array")).toEqual(original);
    });

    test("should round-trip array of numbers", () => {
      const original = [1, 2.5, 0, -3];
      const serialised = new Primitive(original).toString();
      expect(deserialise(serialised, "array")).toEqual(original);
    });

    test("should round-trip array of booleans", () => {
      const original = [true, false, true];
      const serialised = new Primitive(original).toString();
      expect(deserialise(serialised, "array")).toEqual(original);
    });

    test("should round-trip array with null and undefined", () => {
      const original = ["a", null, undefined, "b"];
      const serialised = new Primitive(original).toString();
      expect(deserialise(serialised, "array")).toEqual(original);
    });

    test("should round-trip array with BigInt values", () => {
      const original = [BigInt("9007199254740993"), BigInt(0), BigInt(-42)];
      const serialised = new Primitive(original).toString();
      const result = deserialise(serialised, "array");
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(BigInt("9007199254740993"));
      expect(result[1]).toBe(BigInt(0));
      expect(result[2]).toBe(BigInt(-42));
    });

    test("should round-trip array with Date objects", () => {
      const d1 = new Date("2024-01-01T00:00:00.000Z");
      const d2 = new Date("2025-06-15T12:30:00.000Z");
      const original = [d1, d2];
      const serialised = new Primitive(original).toString();
      const result = deserialise(serialised, "array");
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Date);
      expect(result[0].toISOString()).toBe("2024-01-01T00:00:00.000Z");
      expect(result[1]).toBeInstanceOf(Date);
      expect(result[1].toISOString()).toBe("2025-06-15T12:30:00.000Z");
    });

    test("should round-trip array with Buffer values", () => {
      const original = [Buffer.from("hello"), Buffer.from("world")];
      const serialised = new Primitive(original).toString();
      const result = deserialise(serialised, "array");
      expect(Buffer.isBuffer(result[0])).toBe(true);
      expect(result[0].toString()).toBe("hello");
      expect(result[1].toString()).toBe("world");
    });

    test("should round-trip nested array", () => {
      const original = [
        [1, 2],
        [3, 4],
        ["a", "b"],
      ];
      const serialised = new Primitive(original).toString();
      expect(deserialise(serialised, "array")).toEqual(original);
    });

    test("should round-trip array of objects with mixed types", () => {
      const original = [
        {
          name: "Alice",
          age: 30,
          active: true,
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
        },
        {
          name: "Bob",
          age: null,
          active: false,
          createdAt: new Date("2024-06-01T00:00:00.000Z"),
        },
      ];
      const serialised = new Primitive(original).toString();
      const result = deserialise(serialised, "array");
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Alice");
      expect(result[0].age).toBe(30);
      expect(result[0].active).toBe(true);
      expect(result[0].createdAt).toBeInstanceOf(Date);
      expect(result[1].age).toBeNull();
      expect(result[1].active).toBe(false);
    });

    test("should round-trip empty array", () => {
      const original: any[] = [];
      const serialised = new Primitive(original).toString();
      expect(deserialise(serialised, "array")).toEqual([]);
    });
  });

  describe("object", () => {
    test("should return non-string value as-is", () => {
      const obj = { a: 1 };
      expect(deserialise(obj, "object")).toBe(obj);
    });

    test("should round-trip simple object", () => {
      const original = { foo: "bar", count: 42 };
      const serialised = new Primitive(original).toString();
      expect(deserialise(serialised, "object")).toEqual(original);
    });

    test("should round-trip object with boolean values", () => {
      const original = { active: true, disabled: false };
      const serialised = new Primitive(original).toString();
      expect(deserialise(serialised, "object")).toEqual(original);
    });

    test("should round-trip object with null and undefined", () => {
      const original = { present: "yes", missing: null, gone: undefined };
      const serialised = new Primitive(original).toString();
      const result = deserialise(serialised, "object");
      expect(result.present).toBe("yes");
      expect(result.missing).toBeNull();
      expect(result.gone).toBeUndefined();
    });

    test("should round-trip object with BigInt values", () => {
      const original = {
        big: BigInt("9007199254740993"),
        small: BigInt(42),
      };
      const serialised = new Primitive(original).toString();
      const result = deserialise(serialised, "object");
      expect(result.big).toBe(BigInt("9007199254740993"));
      expect(result.small).toBe(BigInt(42));
    });

    test("should round-trip object with Date values", () => {
      const original = {
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2025-06-15T12:30:00.000Z"),
      };
      const serialised = new Primitive(original).toString();
      const result = deserialise(serialised, "object");
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.createdAt.toISOString()).toBe("2024-01-01T00:00:00.000Z");
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(result.updatedAt.toISOString()).toBe("2025-06-15T12:30:00.000Z");
    });

    test("should round-trip object with Buffer values", () => {
      const original = { secret: Buffer.from("sensitive-data") };
      const serialised = new Primitive(original).toString();
      const result = deserialise(serialised, "object");
      expect(Buffer.isBuffer(result.secret)).toBe(true);
      expect(result.secret.toString()).toBe("sensitive-data");
    });

    test("should round-trip deeply nested object", () => {
      const original = {
        level1: {
          level2: {
            level3: {
              value: "deep",
              date: new Date("2024-01-01T00:00:00.000Z"),
              count: 42,
            },
          },
          tags: ["a", "b"],
        },
      };
      const serialised = new Primitive(original).toString();
      const result = deserialise(serialised, "object");
      expect(result.level1.level2.level3.value).toBe("deep");
      expect(result.level1.level2.level3.date).toBeInstanceOf(Date);
      expect(result.level1.level2.level3.count).toBe(42);
      expect(result.level1.tags).toEqual(["a", "b"]);
    });

    test("should round-trip object with array values containing mixed types", () => {
      const original = {
        items: [
          { id: 1, createdAt: new Date("2024-01-01T00:00:00.000Z") },
          { id: 2, createdAt: new Date("2024-02-01T00:00:00.000Z") },
        ],
        metadata: { total: 2, flag: true },
      };
      const serialised = new Primitive(original).toString();
      const result = deserialise(serialised, "object");
      expect(result.items).toHaveLength(2);
      expect(result.items[0].createdAt).toBeInstanceOf(Date);
      expect(result.items[1].createdAt).toBeInstanceOf(Date);
      expect(result.metadata.total).toBe(2);
      expect(result.metadata.flag).toBe(true);
    });

    test("should round-trip empty object", () => {
      const original = {};
      const serialised = new Primitive(original).toString();
      expect(deserialise(serialised, "object")).toEqual({});
    });
  });

  describe("array from JSON.stringify", () => {
    test("should deserialise JSON.stringify'd string array", () => {
      const original = ["a", "b", "c"];
      const serialised = JSON.stringify(original);
      expect(deserialise(serialised, "array")).toEqual(original);
    });

    test("should deserialise JSON.stringify'd number array", () => {
      const original = [1, 2.5, 0, -3];
      const serialised = JSON.stringify(original);
      expect(deserialise(serialised, "array")).toEqual(original);
    });

    test("should deserialise JSON.stringify'd boolean array", () => {
      const original = [true, false, true];
      const serialised = JSON.stringify(original);
      expect(deserialise(serialised, "array")).toEqual(original);
    });

    test("should deserialise JSON.stringify'd array with nulls", () => {
      const original = ["a", null, "b"];
      const serialised = JSON.stringify(original);
      expect(deserialise(serialised, "array")).toEqual(original);
    });

    test("should NOT restore Dates from JSON.stringify'd array", () => {
      const original = [new Date("2024-01-01T00:00:00.000Z")];
      const serialised = JSON.stringify(original);
      const result = deserialise(serialised, "array");
      // JSON.stringify converts Dates to ISO strings — Primitive cannot restore them
      // without __meta__ type markers
      expect(result[0]).not.toBeInstanceOf(Date);
      expect(result[0]).toBe("2024-01-01T00:00:00.000Z");
    });

    test("should deserialise JSON.stringify'd nested array", () => {
      const original = [
        [1, 2],
        ["a", "b"],
      ];
      const serialised = JSON.stringify(original);
      expect(deserialise(serialised, "array")).toEqual(original);
    });
  });

  describe("object from JSON.stringify", () => {
    test("should deserialise JSON.stringify'd simple object", () => {
      const original = { foo: "bar", count: 42 };
      const serialised = JSON.stringify(original);
      expect(deserialise(serialised, "object")).toEqual(original);
    });

    test("should deserialise JSON.stringify'd object with booleans", () => {
      const original = { active: true, disabled: false };
      const serialised = JSON.stringify(original);
      expect(deserialise(serialised, "object")).toEqual(original);
    });

    test("should deserialise JSON.stringify'd object with nulls", () => {
      const original = { present: "yes", missing: null };
      const serialised = JSON.stringify(original);
      expect(deserialise(serialised, "object")).toEqual(original);
    });

    test("should NOT restore Dates from JSON.stringify'd object", () => {
      const original = { createdAt: new Date("2024-01-01T00:00:00.000Z") };
      const serialised = JSON.stringify(original);
      const result = deserialise(serialised, "object");
      // JSON.stringify converts Dates to ISO strings — Primitive cannot restore them
      expect(result.createdAt).not.toBeInstanceOf(Date);
      expect(result.createdAt).toBe("2024-01-01T00:00:00.000Z");
    });

    test("should NOT restore Buffers from JSON.stringify'd object", () => {
      const original = { secret: Buffer.from("data") };
      const serialised = JSON.stringify(original);
      const result = deserialise(serialised, "object");
      // JSON.stringify converts Buffers to { type: "Buffer", data: [...] }
      expect(Buffer.isBuffer(result.secret)).toBe(false);
    });

    test("should deserialise JSON.stringify'd deeply nested object", () => {
      const original = {
        level1: { level2: { value: "deep", count: 42 } },
        tags: ["a", "b"],
      };
      const serialised = JSON.stringify(original);
      expect(deserialise(serialised, "object")).toEqual(original);
    });
  });

  describe("passthrough types", () => {
    test("should pass through for string type", () => {
      expect(deserialise("hello", "string")).toBe("hello");
    });

    test("should pass through for uuid type", () => {
      expect(deserialise("abc-123", "uuid")).toBe("abc-123");
    });

    test("should pass through for null type", () => {
      expect(deserialise("value", null)).toBe("value");
    });

    test("should pass through for unknown type", () => {
      expect(deserialise("value", "custom")).toBe("value");
    });
  });
});
