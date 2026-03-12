import type { MetaField, MetaRelation } from "#internal/entity/types/metadata";
import { RedisDriverError } from "../errors/RedisDriverError";
import { deserializeHash } from "./deserialize-hash";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeField = (overrides: Partial<MetaField> = {}): MetaField =>
  ({
    key: "name",
    decorator: "Field",
    type: "string",
    computed: null,
    embedded: null,
    encrypted: null,
    transform: null,
    nullable: false,
    readonly: false,
    ...overrides,
  }) as unknown as MetaField;

const makeRelation = (overrides: Partial<MetaRelation> = {}): MetaRelation =>
  ({
    type: "ManyToOne",
    key: "author",
    joinKeys: { authorId: "id" },
    ...overrides,
  }) as unknown as MetaRelation;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("deserializeHash", () => {
  describe("empty hash", () => {
    test("should return null for empty hash", () => {
      const fields = [makeField()];
      expect(deserializeHash({}, fields, [])).toBeNull();
    });
  });

  describe("basic types", () => {
    test("should deserialize string value", () => {
      const fields = [makeField({ key: "name", type: "string" })];
      expect(deserializeHash({ name: "hello" }, fields, [])).toMatchSnapshot();
    });

    test("should deserialize integer value", () => {
      const fields = [makeField({ key: "age", type: "integer" })];
      expect(deserializeHash({ age: "42" }, fields, [])).toMatchSnapshot();
    });

    test("should deserialize smallint value", () => {
      const fields = [makeField({ key: "rank", type: "smallint" })];
      expect(deserializeHash({ rank: "5" }, fields, [])).toMatchSnapshot();
    });

    test("should deserialize boolean true", () => {
      const fields = [makeField({ key: "active", type: "boolean" })];
      expect(deserializeHash({ active: "true" }, fields, [])).toMatchSnapshot();
    });

    test("should deserialize boolean false", () => {
      const fields = [makeField({ key: "active", type: "boolean" })];
      expect(deserializeHash({ active: "false" }, fields, [])).toMatchSnapshot();
    });

    test("should deserialize float value", () => {
      const fields = [makeField({ key: "score", type: "float" })];
      expect(deserializeHash({ score: "3.14" }, fields, [])).toMatchSnapshot();
    });

    test("should deserialize decimal value", () => {
      const fields = [makeField({ key: "amount", type: "decimal" })];
      expect(deserializeHash({ amount: "99.99" }, fields, [])).toMatchSnapshot();
    });

    test("should deserialize real value", () => {
      const fields = [makeField({ key: "weight", type: "real" })];
      expect(deserializeHash({ weight: "72.5" }, fields, [])).toMatchSnapshot();
    });

    test("should deserialize bigint value", () => {
      const fields = [makeField({ key: "count", type: "bigint" })];
      expect(
        deserializeHash({ count: "9007199254740993" }, fields, []),
      ).toMatchSnapshot();
    });

    test("should deserialize timestamp value", () => {
      const fields = [makeField({ key: "createdAt", type: "timestamp" })];
      const result = deserializeHash(
        { createdAt: "2024-01-15T10:30:00.000Z" },
        fields,
        [],
      );
      expect(result!.createdAt).toBeInstanceOf(Date);
      expect((result!.createdAt as Date).toISOString()).toBe("2024-01-15T10:30:00.000Z");
    });

    test("should deserialize date value", () => {
      const fields = [makeField({ key: "birthday", type: "date" })];
      const result = deserializeHash(
        { birthday: "2024-01-15T00:00:00.000Z" },
        fields,
        [],
      );
      expect(result!.birthday).toBeInstanceOf(Date);
    });

    test("should deserialize uuid as string", () => {
      const fields = [makeField({ key: "id", type: "uuid" })];
      expect(
        deserializeHash({ id: "550e8400-e29b-41d4-a716-446655440000" }, fields, []),
      ).toMatchSnapshot();
    });
  });

  describe("structured types", () => {
    test("should deserialize array from JSON", () => {
      const fields = [makeField({ key: "tags", type: "array" })];
      expect(deserializeHash({ tags: '["a","b","c"]' }, fields, [])).toMatchSnapshot();
    });

    test("should deserialize object from JSON", () => {
      const fields = [makeField({ key: "meta", type: "object" })];
      expect(deserializeHash({ meta: '{"foo":"bar"}' }, fields, [])).toMatchSnapshot();
    });

    test("should deserialize json from JSON", () => {
      const fields = [makeField({ key: "config", type: "json" })];
      expect(
        deserializeHash({ config: '{"nested":{"value":1}}' }, fields, []),
      ).toMatchSnapshot();
    });
  });

  describe("absent keys", () => {
    test("should return null for absent field key", () => {
      const fields = [
        makeField({ key: "name", type: "string" }),
        makeField({ key: "email", type: "email" }),
      ];
      expect(deserializeHash({ name: "test" }, fields, [])).toMatchSnapshot();
    });
  });

  describe("computed fields", () => {
    test("should skip computed fields", () => {
      const fields = [
        makeField({ key: "name", type: "string" }),
        makeField({ key: "fullName", type: "string", computed: "expr" }),
      ];
      expect(
        deserializeHash({ name: "test", fullName: "full" }, fields, []),
      ).toMatchSnapshot();
    });
  });

  describe("transform", () => {
    test("should apply transform.from() when value is non-null", () => {
      const fields = [
        makeField({
          key: "data",
          type: "string",
          transform: {
            to: (v: unknown) => v,
            from: (v: unknown) => `transformed:${v}`,
          },
        }),
      ];
      expect(deserializeHash({ data: "raw" }, fields, [])).toMatchSnapshot();
    });

    test("should not apply transform when value is null (absent)", () => {
      const fields = [
        makeField({
          key: "data",
          type: "string",
          transform: {
            to: (v: unknown) => v,
            from: (v: unknown) => `transformed:${v}`,
          },
        }),
      ];
      // key absent → null, no transform
      expect(deserializeHash({ other: "val" }, fields, [])).toMatchSnapshot();
    });
  });

  describe("FK columns from relations", () => {
    test("should deserialize FK column from owning relation", () => {
      const fields = [makeField({ key: "name", type: "string" })];
      const relations = [makeRelation()];
      expect(
        deserializeHash({ name: "test", authorId: "author-1" }, fields, relations),
      ).toMatchSnapshot();
    });

    test("should return null for absent FK column", () => {
      const fields = [makeField({ key: "name", type: "string" })];
      const relations = [makeRelation()];
      expect(deserializeHash({ name: "test" }, fields, relations)).toMatchSnapshot();
    });

    test("should not deserialize FK for ManyToMany relations", () => {
      const fields = [makeField({ key: "name", type: "string" })];
      const relations = [
        makeRelation({ type: "ManyToMany", joinKeys: { postId: "id" } }),
      ];
      expect(
        deserializeHash({ name: "test", postId: "p1" }, fields, relations),
      ).toMatchSnapshot();
    });

    test("should skip FK column already handled by fields", () => {
      const fields = [
        makeField({ key: "name", type: "string" }),
        makeField({ key: "authorId", type: "uuid" }),
      ];
      const relations = [makeRelation()];
      const result = deserializeHash({ name: "test", authorId: "a1" }, fields, relations);
      expect(result).toMatchSnapshot();
    });
  });

  describe("error handling for invalid data", () => {
    test("should throw RedisDriverError for bigint field with invalid value", () => {
      const fields = [makeField({ key: "count", type: "bigint" })];
      expect(() => deserializeHash({ count: "not-a-number" }, fields, [])).toThrow(
        RedisDriverError,
      );
    });

    test("should match snapshot for bigint invalid error message", () => {
      const fields = [makeField({ key: "count", type: "bigint" })];
      expect(() =>
        deserializeHash({ count: "not-a-number" }, fields, []),
      ).toThrowErrorMatchingSnapshot();
    });

    test("should throw RedisDriverError for integer field with invalid value", () => {
      const fields = [makeField({ key: "age", type: "integer" })];
      expect(() => deserializeHash({ age: "abc" }, fields, [])).toThrow(RedisDriverError);
    });

    test("should match snapshot for integer invalid error message", () => {
      const fields = [makeField({ key: "age", type: "integer" })];
      expect(() =>
        deserializeHash({ age: "abc" }, fields, []),
      ).toThrowErrorMatchingSnapshot();
    });

    test("should throw RedisDriverError for float field with invalid value", () => {
      const fields = [makeField({ key: "score", type: "float" })];
      expect(() => deserializeHash({ score: "xyz" }, fields, [])).toThrow(
        RedisDriverError,
      );
    });

    test("should match snapshot for float invalid error message", () => {
      const fields = [makeField({ key: "score", type: "float" })];
      expect(() =>
        deserializeHash({ score: "xyz" }, fields, []),
      ).toThrowErrorMatchingSnapshot();
    });

    test("should throw RedisDriverError for real field with invalid value", () => {
      const fields = [makeField({ key: "weight", type: "real" })];
      expect(() => deserializeHash({ weight: "xyz" }, fields, [])).toThrow(
        RedisDriverError,
      );
    });

    test("should match snapshot for real invalid error message", () => {
      const fields = [makeField({ key: "weight", type: "real" })];
      expect(() =>
        deserializeHash({ weight: "xyz" }, fields, []),
      ).toThrowErrorMatchingSnapshot();
    });

    test("should throw RedisDriverError for decimal field with invalid value", () => {
      const fields = [makeField({ key: "amount", type: "decimal" })];
      expect(() => deserializeHash({ amount: "xyz" }, fields, [])).toThrow(
        RedisDriverError,
      );
    });

    test("should match snapshot for decimal invalid error message", () => {
      const fields = [makeField({ key: "amount", type: "decimal" })];
      expect(() =>
        deserializeHash({ amount: "xyz" }, fields, []),
      ).toThrowErrorMatchingSnapshot();
    });

    test("should deserialize bigint field with large valid value", () => {
      const fields = [makeField({ key: "count", type: "bigint" })];
      expect(
        deserializeHash({ count: "12345678901234567890" }, fields, []),
      ).toMatchSnapshot();
    });

    test("should deserialize integer field with valid negative number", () => {
      const fields = [makeField({ key: "offset", type: "integer" })];
      expect(deserializeHash({ offset: "-42" }, fields, [])).toMatchSnapshot();
    });

    test("should deserialize float field with valid scientific notation", () => {
      const fields = [makeField({ key: "distance", type: "float" })];
      expect(deserializeHash({ distance: "1.5e10" }, fields, [])).toMatchSnapshot();
    });
  });

  describe("string-like types pass through", () => {
    const stringTypes = [
      "string",
      "text",
      "varchar",
      "enum",
      "email",
      "url",
      "cidr",
      "inet",
      "macaddr",
      "binary",
      "time",
      "interval",
      "xml",
    ] as const;

    for (const type of stringTypes) {
      test(`should pass through ${type} as string`, () => {
        const fields = [makeField({ key: "val", type })];
        expect(deserializeHash({ val: "test-value" }, fields, [])).toMatchSnapshot();
      });
    }
  });
});
