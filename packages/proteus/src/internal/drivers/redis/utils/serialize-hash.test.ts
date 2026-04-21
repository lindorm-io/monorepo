import type { MetaField, MetaRelation } from "../../../entity/types/metadata.js";
import { serializeHash } from "./serialize-hash.js";
import { deserializeHash } from "./deserialize-hash.js";
import { describe, expect, test } from "vitest";

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

describe("serializeHash", () => {
  describe("basic types", () => {
    test("should serialize string value", () => {
      const fields = [makeField({ key: "name", type: "string" })];
      const row = { name: "hello" };
      expect(serializeHash(row, fields, [])).toMatchSnapshot();
    });

    test("should serialize number value", () => {
      const fields = [makeField({ key: "age", type: "integer" })];
      const row = { age: 42 };
      expect(serializeHash(row, fields, [])).toMatchSnapshot();
    });

    test("should serialize boolean value", () => {
      const fields = [makeField({ key: "active", type: "boolean" })];
      const row = { active: true };
      expect(serializeHash(row, fields, [])).toMatchSnapshot();
    });

    test("should serialize false boolean", () => {
      const fields = [makeField({ key: "active", type: "boolean" })];
      const row = { active: false };
      expect(serializeHash(row, fields, [])).toMatchSnapshot();
    });

    test("should serialize Date value", () => {
      const fields = [makeField({ key: "createdAt", type: "timestamp" })];
      const date = new Date("2024-01-15T10:30:00.000Z");
      const row = { createdAt: date };
      expect(serializeHash(row, fields, [])).toMatchSnapshot();
    });

    test("should serialize bigint value", () => {
      const fields = [makeField({ key: "count", type: "bigint" })];
      const row = { count: BigInt(9007199254740993) };
      expect(serializeHash(row, fields, [])).toMatchSnapshot();
    });

    test("should serialize uuid value", () => {
      const fields = [makeField({ key: "id", type: "uuid" })];
      const row = { id: "550e8400-e29b-41d4-a716-446655440000" };
      expect(serializeHash(row, fields, [])).toMatchSnapshot();
    });
  });

  describe("structured types", () => {
    test("should serialize array value as JSON", () => {
      const fields = [makeField({ key: "tags", type: "array" })];
      const row = { tags: ["a", "b", "c"] };
      expect(serializeHash(row, fields, [])).toMatchSnapshot();
    });

    test("should serialize object value as JSON", () => {
      const fields = [makeField({ key: "meta", type: "object" })];
      const row = { meta: { foo: "bar" } };
      expect(serializeHash(row, fields, [])).toMatchSnapshot();
    });

    test("should serialize json value as JSON", () => {
      const fields = [makeField({ key: "config", type: "json" })];
      const row = { config: { nested: { value: 1 } } };
      expect(serializeHash(row, fields, [])).toMatchSnapshot();
    });
  });

  describe("null/undefined handling", () => {
    test("should omit null values", () => {
      const fields = [
        makeField({ key: "name", type: "string" }),
        makeField({ key: "email", type: "email" }),
      ];
      const row = { name: "test", email: null };
      expect(serializeHash(row, fields, [])).toMatchSnapshot();
    });

    test("should omit undefined values", () => {
      const fields = [
        makeField({ key: "name", type: "string" }),
        makeField({ key: "email", type: "email" }),
      ];
      const row = { name: "test" };
      expect(serializeHash(row, fields, [])).toMatchSnapshot();
    });
  });

  describe("computed fields", () => {
    test("should skip computed fields", () => {
      const fields = [
        makeField({ key: "name", type: "string" }),
        makeField({ key: "fullName", type: "string", computed: "CONCAT(first, last)" }),
      ];
      const row = { name: "test", fullName: "full" };
      expect(serializeHash(row, fields, [])).toMatchSnapshot();
    });
  });

  describe("FK columns from relations", () => {
    test("should serialize FK column from owning relation", () => {
      const fields = [makeField({ key: "name", type: "string" })];
      const relations = [makeRelation()];
      const row = { name: "test", authorId: "author-1" };
      expect(serializeHash(row, fields, relations)).toMatchSnapshot();
    });

    test("should not serialize FK for ManyToMany relations", () => {
      const fields = [makeField({ key: "name", type: "string" })];
      const relations = [
        makeRelation({ type: "ManyToMany", joinKeys: { postId: "id" } }),
      ];
      const row = { name: "test", postId: "p1" };
      expect(serializeHash(row, fields, relations)).toMatchSnapshot();
    });

    test("should not serialize FK when relation has no joinKeys", () => {
      const fields = [makeField({ key: "name", type: "string" })];
      const relations = [makeRelation({ joinKeys: null })];
      const row = { name: "test" };
      expect(serializeHash(row, fields, relations)).toMatchSnapshot();
    });

    test("should skip FK column already handled by fields", () => {
      const fields = [
        makeField({ key: "name", type: "string" }),
        makeField({ key: "authorId", type: "uuid" }),
      ];
      const relations = [makeRelation()];
      const row = { name: "test", authorId: "author-1" };
      const result = serializeHash(row, fields, relations);
      // authorId should appear once, not duplicated
      expect(result).toMatchSnapshot();
    });

    test("should omit null FK values", () => {
      const fields = [makeField({ key: "name", type: "string" })];
      const relations = [makeRelation()];
      const row = { name: "test", authorId: null };
      expect(serializeHash(row, fields, relations)).toMatchSnapshot();
    });
  });

  describe("multiple fields", () => {
    test("should serialize multiple fields of different types", () => {
      const fields = [
        makeField({ key: "id", type: "uuid" }),
        makeField({ key: "name", type: "string" }),
        makeField({ key: "age", type: "integer" }),
        makeField({ key: "active", type: "boolean" }),
        makeField({ key: "createdAt", type: "timestamp" }),
      ];
      const row = {
        id: "abc-123",
        name: "Test User",
        age: 30,
        active: true,
        createdAt: new Date("2024-06-01T00:00:00.000Z"),
      };
      expect(serializeHash(row, fields, [])).toMatchSnapshot();
    });
  });
});

// ─── Round-trip Tests ─────────────────────────────────────────────────────────

describe("serialize/deserialize round-trip", () => {
  const roundTrip = (
    row: Record<string, unknown>,
    fields: Array<MetaField>,
    relations: Array<MetaRelation> = [],
  ) => {
    const hash = serializeHash(row, fields, relations);
    return deserializeHash(hash, fields, relations);
  };

  test.each([
    { type: "string", key: "val", input: "hello world", expected: "hello world" },
    { type: "integer", key: "val", input: 42, expected: 42 },
    { type: "integer", key: "val", input: 0, expected: 0 },
    { type: "integer", key: "val", input: -7, expected: -7 },
    { type: "smallint", key: "val", input: 5, expected: 5 },
    {
      type: "bigint",
      key: "val",
      input: BigInt("9007199254740993"),
      expected: BigInt("9007199254740993"),
    },
    { type: "float", key: "val", input: 3.14, expected: 3.14 },
    { type: "real", key: "val", input: 2.718, expected: 2.718 },
    { type: "decimal", key: "val", input: 99.99, expected: 99.99 },
    { type: "boolean", key: "val", input: true, expected: true },
    { type: "boolean", key: "val", input: false, expected: false },
    {
      type: "uuid",
      key: "val",
      input: "550e8400-e29b-41d4-a716-446655440000",
      expected: "550e8400-e29b-41d4-a716-446655440000",
    },
    { type: "enum", key: "val", input: "active", expected: "active" },
  ] as const)("should round-trip $type ($input)", ({ type, key, input, expected }) => {
    const fields = [makeField({ key, type: type as any })];
    const result = roundTrip({ [key]: input }, fields);
    expect(result).not.toBeNull();
    expect(result![key]).toEqual(expected);
  });

  test("should round-trip timestamp (Date)", () => {
    const fields = [makeField({ key: "ts", type: "timestamp" })];
    const date = new Date("2024-06-15T12:30:00.000Z");
    const result = roundTrip({ ts: date }, fields);
    expect(result).not.toBeNull();
    expect(result!.ts).toBeInstanceOf(Date);
    expect((result!.ts as Date).toISOString()).toBe("2024-06-15T12:30:00.000Z");
  });

  test("should round-trip date (Date)", () => {
    const fields = [makeField({ key: "d", type: "date" })];
    const date = new Date("2024-01-01T00:00:00.000Z");
    const result = roundTrip({ d: date }, fields);
    expect(result).not.toBeNull();
    expect(result!.d).toBeInstanceOf(Date);
    expect((result!.d as Date).toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });

  test("should round-trip json object", () => {
    const fields = [makeField({ key: "cfg", type: "json" })];
    const obj = { nested: { a: 1, b: [2, 3] }, flag: true };
    const result = roundTrip({ cfg: obj }, fields);
    expect(result).not.toBeNull();
    expect(result!.cfg).toEqual(obj);
  });

  test("should round-trip json array", () => {
    const fields = [makeField({ key: "cfg", type: "json" })];
    const arr = [1, "two", { three: 3 }];
    const result = roundTrip({ cfg: arr }, fields);
    expect(result).not.toBeNull();
    expect(result!.cfg).toEqual(arr);
  });

  test("should round-trip object type", () => {
    const fields = [makeField({ key: "meta", type: "object" })];
    const obj = { x: "y", nested: { z: 10 } };
    const result = roundTrip({ meta: obj }, fields);
    expect(result).not.toBeNull();
    expect(result!.meta).toEqual(obj);
  });

  test("should round-trip array type", () => {
    const fields = [makeField({ key: "tags", type: "array" })];
    const arr = ["alpha", "beta", "gamma"];
    const result = roundTrip({ tags: arr }, fields);
    expect(result).not.toBeNull();
    expect(result!.tags).toEqual(arr);
  });

  test("should round-trip null fields as absent keys", () => {
    const fields = [
      makeField({ key: "name", type: "string" }),
      makeField({ key: "email", type: "string" }),
    ];
    const result = roundTrip({ name: "test", email: null }, fields);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("test");
    expect(result!.email).toBeNull();
  });

  test("should round-trip FK columns from owning relations", () => {
    const fields = [makeField({ key: "name", type: "string" })];
    const relations = [makeRelation()];
    const result = roundTrip({ name: "test", authorId: "author-1" }, fields, relations);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("test");
    expect(result!.authorId).toBe("author-1");
  });

  test("should round-trip multiple fields of different types", () => {
    const fields = [
      makeField({ key: "id", type: "uuid" }),
      makeField({ key: "name", type: "string" }),
      makeField({ key: "age", type: "integer" }),
      makeField({ key: "active", type: "boolean" }),
      makeField({ key: "score", type: "float" }),
      makeField({ key: "tags", type: "array" }),
      makeField({ key: "createdAt", type: "timestamp" }),
    ];
    const row = {
      id: "abc-123",
      name: "Test User",
      age: 30,
      active: true,
      score: 95.5,
      tags: ["a", "b"],
      createdAt: new Date("2024-06-01T00:00:00.000Z"),
    };
    const result = roundTrip(row, fields);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("abc-123");
    expect(result!.name).toBe("Test User");
    expect(result!.age).toBe(30);
    expect(result!.active).toBe(true);
    expect(result!.score).toBe(95.5);
    expect(result!.tags).toEqual(["a", "b"]);
    expect(result!.createdAt).toBeInstanceOf(Date);
    expect((result!.createdAt as Date).toISOString()).toBe("2024-06-01T00:00:00.000Z");
  });
});
