import { EntityKitError } from "../../errors";
import { MetaColumnType } from "../../types";
import { parseColumn } from "./parse-column";

const col = (overrides: Record<string, any> = {}) =>
  ({
    key: "test",
    type: "string" as MetaColumnType,
    decorator: "Column" as const,
    enum: null,
    fallback: null,
    max: null,
    min: null,
    nullable: false,
    optional: false,
    readonly: false,
    schema: null,
    ...overrides,
  }) as any;

const entity = (value: any) => ({ test: value }) as any;

describe("parseColumn", () => {
  describe("null/undefined handling", () => {
    test("should return null when nullable", () => {
      expect(parseColumn(col({ nullable: true }), entity(null))).toBeNull();
    });

    test("should return undefined when optional", () => {
      expect(parseColumn(col({ optional: true }), entity(undefined))).toBeUndefined();
    });

    test("should use static fallback when value is null", () => {
      expect(parseColumn(col({ fallback: "default" }), entity(null))).toEqual("default");
    });

    test("should use function fallback when value is null", () => {
      expect(parseColumn(col({ fallback: () => "computed" }), entity(null))).toEqual(
        "computed",
      );
    });

    test("should prefer options over entity value", () => {
      expect(
        parseColumn(col(), entity("entity-val"), { test: "opt-val" } as any),
      ).toEqual("opt-val");
    });
  });

  describe("bigint", () => {
    test("should return bigint as-is", () => {
      expect(parseColumn(col({ type: "bigint" }), entity(BigInt(42)))).toEqual(
        BigInt(42),
      );
    });

    test("should convert number to bigint", () => {
      expect(parseColumn(col({ type: "bigint" }), entity(42))).toEqual(BigInt(42));
    });

    test("should convert string to bigint", () => {
      expect(parseColumn(col({ type: "bigint" }), entity("99"))).toEqual(BigInt(99));
    });

    test("should return BigInt(0) for null after null checks", () => {
      expect(parseColumn(col({ type: "bigint" }), entity(null))).toEqual(BigInt(0));
    });

    test("should throw for unconvertible value", () => {
      expect(() => parseColumn(col({ type: "bigint" }), entity("not-a-number"))).toThrow(
        EntityKitError,
      );
    });
  });

  describe("boolean", () => {
    test("should return boolean as-is", () => {
      expect(parseColumn(col({ type: "boolean" }), entity(true))).toEqual(true);
      expect(parseColumn(col({ type: "boolean" }), entity(false))).toEqual(false);
    });

    test("should deserialize string 'true' to true", () => {
      expect(parseColumn(col({ type: "boolean" }), entity("true"))).toEqual(true);
    });

    test("should deserialize string 'false' to false", () => {
      expect(parseColumn(col({ type: "boolean" }), entity("false"))).toEqual(false);
    });

    test("should coerce falsy value to false", () => {
      expect(parseColumn(col({ type: "boolean" }), entity(0))).toEqual(false);
    });

    test("should coerce truthy number to true", () => {
      expect(parseColumn(col({ type: "boolean" }), entity(1))).toEqual(true);
    });
  });

  describe("date", () => {
    const now = new Date("2024-01-01T00:00:00.000Z");

    test("should return Date as-is", () => {
      expect(parseColumn(col({ type: "date" }), entity(now))).toEqual(now);
    });

    test("should convert string to Date", () => {
      const result = parseColumn(
        col({ type: "date" }),
        entity("2024-01-01T00:00:00.000Z"),
      );
      expect(result).toEqual(now);
    });

    test("should throw for invalid Date object", () => {
      expect(() =>
        parseColumn(col({ type: "date" }), entity(new Date("invalid"))),
      ).toThrow(EntityKitError);
    });

    test("should throw for unconvertible string", () => {
      expect(() => parseColumn(col({ type: "date" }), entity("not-a-date"))).toThrow(
        EntityKitError,
      );
    });

    test("should return null for null after null checks", () => {
      expect(parseColumn(col({ type: "date" }), entity(null))).toBeNull();
    });
  });

  describe("float", () => {
    test("should return number as-is", () => {
      expect(parseColumn(col({ type: "float" }), entity(3.14))).toEqual(3.14);
    });

    test("should convert string to float", () => {
      expect(parseColumn(col({ type: "float" }), entity("3.14"))).toEqual(3.14);
    });

    test("should return 0 for null after null checks", () => {
      expect(parseColumn(col({ type: "float" }), entity(null))).toEqual(0);
    });

    test("should throw for unconvertible value", () => {
      expect(() => parseColumn(col({ type: "float" }), entity("not-a-number"))).toThrow(
        EntityKitError,
      );
    });
  });

  describe("integer", () => {
    test("should return integer as-is", () => {
      expect(parseColumn(col({ type: "integer" }), entity(42))).toEqual(42);
    });

    test("should truncate float to integer", () => {
      expect(parseColumn(col({ type: "integer" }), entity(3.7))).toEqual(3);
    });

    test("should convert string to integer", () => {
      expect(parseColumn(col({ type: "integer" }), entity("42"))).toEqual(42);
    });

    test("should return 0 for null after null checks", () => {
      expect(parseColumn(col({ type: "integer" }), entity(null))).toEqual(0);
    });

    test("should throw for unconvertible value", () => {
      expect(() => parseColumn(col({ type: "integer" }), entity("not-a-number"))).toThrow(
        EntityKitError,
      );
    });
  });

  describe("default (string, uuid, array, object, enum)", () => {
    test("should return value as-is for string type", () => {
      expect(parseColumn(col({ type: "string" }), entity("hello"))).toEqual("hello");
    });

    test("should return value as-is for unknown type", () => {
      expect(parseColumn(col({ type: "custom" }), entity({ a: 1 }))).toEqual({ a: 1 });
    });
  });
});
