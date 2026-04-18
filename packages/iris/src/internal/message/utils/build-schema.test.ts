import { z } from "zod";
import { buildSchema } from "./build-schema";
import type { MetaField } from "../types/metadata";
import type { MessageMetadata } from "../types/metadata";

const makeField = (overrides: Partial<MetaField> = {}): MetaField => ({
  key: "testField",
  decorator: "Field",
  default: null,
  enum: null,
  max: null,
  min: null,
  nullable: false,
  optional: false,
  schema: null,
  transform: null,
  type: "string",
  ...overrides,
});

const makeMetadata = (fields: Array<MetaField>): MessageMetadata =>
  ({
    fields,
  }) as MessageMetadata;

const parse = (schema: z.ZodType, data: unknown) => z.safeParse(schema, data);

describe("buildSchema", () => {
  describe("field type mapping", () => {
    it("should create a string validator", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "name", type: "string" })]),
      );
      expect(parse(schema, { name: "hello" })).toMatchSnapshot();
      expect(parse(schema, { name: 123 }).success).toBe(false);
    });

    it("should create an integer validator", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "count", type: "integer" })]),
      );
      expect(parse(schema, { count: 42 })).toMatchSnapshot();
      expect(parse(schema, { count: 3.14 }).success).toBe(false);
      expect(parse(schema, { count: "42" }).success).toBe(false);
    });

    it("should create a float validator", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "price", type: "float" })]),
      );
      expect(parse(schema, { price: 3.14 })).toMatchSnapshot();
      expect(parse(schema, { price: 42 })).toMatchSnapshot();
      expect(parse(schema, { price: "3.14" }).success).toBe(false);
    });

    it("should create a bigint validator", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "big", type: "bigint" })]),
      );
      expect(parse(schema, { big: BigInt(999) })).toMatchSnapshot();
      expect(parse(schema, { big: 999 }).success).toBe(false);
    });

    it("should create a boolean validator", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "flag", type: "boolean" })]),
      );
      expect(parse(schema, { flag: true })).toMatchSnapshot();
      expect(parse(schema, { flag: false })).toMatchSnapshot();
      expect(parse(schema, { flag: "true" }).success).toBe(false);
    });

    it("should create a date validator", () => {
      const schema = buildSchema(makeMetadata([makeField({ key: "at", type: "date" })]));
      expect(
        parse(schema, { at: new Date("2024-01-01T00:00:00.000Z") }),
      ).toMatchSnapshot();
      expect(parse(schema, { at: "2024-01-01" }).success).toBe(false);
    });

    it("should create a uuid validator", () => {
      const schema = buildSchema(makeMetadata([makeField({ key: "id", type: "uuid" })]));
      expect(
        parse(schema, { id: "550e8400-e29b-41d4-a716-446655440000" }),
      ).toMatchSnapshot();
      expect(parse(schema, { id: "not-a-uuid" }).success).toBe(false);
    });

    it("should create an email validator", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "email", type: "email" })]),
      );
      expect(parse(schema, { email: "test@example.com" })).toMatchSnapshot();
      expect(parse(schema, { email: "not-an-email" }).success).toBe(false);
    });

    it("should create a url validator", () => {
      const schema = buildSchema(makeMetadata([makeField({ key: "link", type: "url" })]));
      expect(parse(schema, { link: "https://example.com" })).toMatchSnapshot();
      expect(parse(schema, { link: "not-a-url" }).success).toBe(false);
    });

    it("should create an array validator", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "items", type: "array" })]),
      );
      expect(parse(schema, { items: [1, "two", true] })).toMatchSnapshot();
      expect(parse(schema, { items: "not-array" }).success).toBe(false);
    });

    it("should create an object validator", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "data", type: "object" })]),
      );
      expect(parse(schema, { data: { a: 1 } })).toMatchSnapshot();
      expect(parse(schema, { data: "not-object" }).success).toBe(false);
    });

    it("should create an enum validator", () => {
      const enumValues = { Active: "active", Inactive: "inactive" } as const;
      const schema = buildSchema(
        makeMetadata([makeField({ key: "status", type: "enum", enum: enumValues })]),
      );
      expect(parse(schema, { status: "active" })).toMatchSnapshot();
      expect(parse(schema, { status: "unknown" }).success).toBe(false);
    });
  });

  describe("min/max constraints", () => {
    it("should apply min/max to string (minLength/maxLength)", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "name", type: "string", min: 2, max: 10 })]),
      );
      expect(parse(schema, { name: "ab" }).success).toBe(true);
      expect(parse(schema, { name: "a" }).success).toBe(false);
      expect(parse(schema, { name: "a".repeat(11) }).success).toBe(false);
    });

    it("should apply min/max to integer", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "n", type: "integer", min: 1, max: 100 })]),
      );
      expect(parse(schema, { n: 1 }).success).toBe(true);
      expect(parse(schema, { n: 100 }).success).toBe(true);
      expect(parse(schema, { n: 0 }).success).toBe(false);
      expect(parse(schema, { n: 101 }).success).toBe(false);
    });

    it("should apply min/max to float", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "f", type: "float", min: 0.5, max: 9.9 })]),
      );
      expect(parse(schema, { f: 0.5 }).success).toBe(true);
      expect(parse(schema, { f: 0.4 }).success).toBe(false);
      expect(parse(schema, { f: 10.0 }).success).toBe(false);
    });

    it("should apply min/max to bigint", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "b", type: "bigint", min: 10, max: 1000 })]),
      );
      expect(parse(schema, { b: BigInt(10) }).success).toBe(true);
      expect(parse(schema, { b: BigInt(1000) }).success).toBe(true);
      expect(parse(schema, { b: BigInt(9) }).success).toBe(false);
      expect(parse(schema, { b: BigInt(1001) }).success).toBe(false);
    });

    it("should apply min/max to array (minLength/maxLength)", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "arr", type: "array", min: 1, max: 3 })]),
      );
      expect(parse(schema, { arr: [1] }).success).toBe(true);
      expect(parse(schema, { arr: [1, 2, 3] }).success).toBe(true);
      expect(parse(schema, { arr: [] }).success).toBe(false);
      expect(parse(schema, { arr: [1, 2, 3, 4] }).success).toBe(false);
    });

    it("should apply only min when max is null", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "s", type: "string", min: 3, max: null })]),
      );
      expect(parse(schema, { s: "abc" }).success).toBe(true);
      expect(parse(schema, { s: "ab" }).success).toBe(false);
      expect(parse(schema, { s: "a".repeat(1000) }).success).toBe(true);
    });

    it("should apply only max when min is null", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "s", type: "string", min: null, max: 5 })]),
      );
      expect(parse(schema, { s: "" }).success).toBe(true);
      expect(parse(schema, { s: "abcde" }).success).toBe(true);
      expect(parse(schema, { s: "abcdef" }).success).toBe(false);
    });
  });

  describe("nullable", () => {
    it("should accept null for a nullable field", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "name", type: "string", nullable: true })]),
      );
      expect(parse(schema, { name: null }).success).toBe(true);
    });

    it("should NOT accept undefined for a nullable-only field", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "name", type: "string", nullable: true })]),
      );
      expect(parse(schema, {}).success).toBe(false);
    });

    it("should still accept the base type for a nullable field", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "name", type: "string", nullable: true })]),
      );
      expect(parse(schema, { name: "hello" }).success).toBe(true);
    });
  });

  describe("optional", () => {
    it("should accept undefined for an optional field", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "name", type: "string", optional: true })]),
      );
      expect(parse(schema, {}).success).toBe(true);
    });

    it("should NOT accept null for an optional-only field", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "name", type: "string", optional: true })]),
      );
      expect(parse(schema, { name: null }).success).toBe(false);
    });

    it("should still accept the base type for an optional field", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "name", type: "string", optional: true })]),
      );
      expect(parse(schema, { name: "hello" }).success).toBe(true);
    });
  });

  describe("nullable + optional", () => {
    it("should accept null", () => {
      const schema = buildSchema(
        makeMetadata([
          makeField({ key: "name", type: "string", nullable: true, optional: true }),
        ]),
      );
      expect(parse(schema, { name: null }).success).toBe(true);
    });

    it("should accept undefined (missing key)", () => {
      const schema = buildSchema(
        makeMetadata([
          makeField({ key: "name", type: "string", nullable: true, optional: true }),
        ]),
      );
      expect(parse(schema, {}).success).toBe(true);
    });

    it("should accept the base type", () => {
      const schema = buildSchema(
        makeMetadata([
          makeField({ key: "name", type: "string", nullable: true, optional: true }),
        ]),
      );
      expect(parse(schema, { name: "hello" }).success).toBe(true);
    });
  });

  describe("multiple fields", () => {
    it("should validate an object with multiple fields of different types", () => {
      const schema = buildSchema(
        makeMetadata([
          makeField({ key: "name", type: "string" }),
          makeField({ key: "age", type: "integer" }),
          makeField({ key: "active", type: "boolean" }),
        ]),
      );
      expect(parse(schema, { name: "Alice", age: 30, active: true })).toMatchSnapshot();
    });

    it("should fail when any required field is missing", () => {
      const schema = buildSchema(
        makeMetadata([
          makeField({ key: "name", type: "string" }),
          makeField({ key: "age", type: "integer" }),
        ]),
      );
      expect(parse(schema, { name: "Alice" }).success).toBe(false);
    });
  });

  describe("unknown field type", () => {
    it("should skip fields with an unrecognized type and reject them as unknown keys", () => {
      const schema = buildSchema(
        makeMetadata([makeField({ key: "x", type: "unknown" as any })]),
      );
      expect(parse(schema, {}).success).toBe(true);
      expect(parse(schema, { x: "anything" }).success).toBe(false);
    });
  });

  describe("empty fields", () => {
    it("should accept an empty object but reject any extra keys when fields array is empty", () => {
      const schema = buildSchema(makeMetadata([]));
      expect(parse(schema, {}).success).toBe(true);
      expect(parse(schema, { extra: "data" }).success).toBe(false);
    });
  });

  describe("strict validation", () => {
    it("should reject unknown top-level keys on the message", () => {
      const schema = buildSchema(makeMetadata([makeField({ key: "id", type: "uuid" })]));
      const result = parse(schema, {
        id: "550e8400-e29b-41d4-a716-446655440000",
        stray: "should not be here",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("validation errors", () => {
    it("should produce meaningful error output on failure", () => {
      const schema = buildSchema(
        makeMetadata([
          makeField({ key: "email", type: "email" }),
          makeField({ key: "count", type: "integer", min: 1 }),
        ]),
      );
      const result = parse(schema, { email: "bad", count: 0 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot();
      }
    });
  });
});
