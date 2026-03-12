import { ProteusError } from "../../../../../errors";
import type { MetaIndex } from "#internal/entity/types/metadata";
import { generateIndexDDL } from "./generate-index-ddl";

const TABLE = "products";
const NS = null;
const NS_SCOPED = "catalog";

// ---------------------------------------------------------------------------
// Helper to build MetaIndex objects
// ---------------------------------------------------------------------------

const idx = (overrides: Partial<MetaIndex> & { keys: MetaIndex["keys"] }): MetaIndex => ({
  include: null,
  name: null,
  unique: false,
  concurrent: false,
  sparse: false,
  where: null,
  using: null,
  with: null,
  ...overrides,
});

describe("generateIndexDDL", () => {
  test("returns empty array when no indexes are provided", () => {
    expect(generateIndexDDL([], TABLE, NS, [])).toEqual([]);
  });

  test("generates a simple ASC index with auto-name", () => {
    const indexes = [idx({ keys: [{ key: "email", direction: "asc", nulls: null }] })];
    expect(generateIndexDDL(indexes, TABLE, NS, [])).toMatchSnapshot();
  });

  test("generates a DESC index", () => {
    const indexes = [
      idx({ keys: [{ key: "createdAt", direction: "desc", nulls: null }] }),
    ];
    expect(generateIndexDDL(indexes, TABLE, NS, [])).toMatchSnapshot();
  });

  test("generates a named index", () => {
    const indexes = [
      idx({ keys: [{ key: "name", direction: "asc", nulls: null }], name: "idx_name" }),
    ];
    expect(generateIndexDDL(indexes, TABLE, NS, [])).toMatchSnapshot();
  });

  test("generates a UNIQUE index", () => {
    const indexes = [
      idx({ keys: [{ key: "slug", direction: "asc", nulls: null }], unique: true }),
    ];
    expect(generateIndexDDL(indexes, TABLE, NS, [])).toMatchSnapshot();
  });

  test("generates a composite index", () => {
    const indexes = [
      idx({
        keys: [
          { key: "tenant_id", direction: "asc", nulls: null },
          { key: "email", direction: "asc", nulls: null },
        ],
      }),
    ];
    expect(generateIndexDDL(indexes, TABLE, NS, [])).toMatchSnapshot();
  });

  test("generates a CONCURRENTLY index", () => {
    const indexes = [
      idx({
        keys: [{ key: "email", direction: "asc", nulls: null }],
        concurrent: true,
      }),
    ];
    expect(generateIndexDDL(indexes, TABLE, NS, [])).toMatchSnapshot();
  });

  test("generates index with NULLS FIRST", () => {
    const indexes = [
      idx({ keys: [{ key: "deletedAt", direction: "asc", nulls: "first" }] }),
    ];
    expect(generateIndexDDL(indexes, TABLE, NS, [])).toMatchSnapshot();
  });

  test("generates index with NULLS LAST", () => {
    const indexes = [
      idx({ keys: [{ key: "deletedAt", direction: "desc", nulls: "last" }] }),
    ];
    expect(generateIndexDDL(indexes, TABLE, NS, [])).toMatchSnapshot();
  });

  test("generates index with INCLUDE columns", () => {
    const indexes = [
      idx({
        keys: [{ key: "email", direction: "asc", nulls: null }],
        include: ["name", "age"],
      }),
    ];
    expect(generateIndexDDL(indexes, TABLE, NS, [])).toMatchSnapshot();
  });

  test("generates index with USING gin", () => {
    const indexes = [
      idx({
        keys: [{ key: "tags", direction: "asc", nulls: null }],
        using: "gin",
      }),
    ];
    expect(generateIndexDDL(indexes, TABLE, NS, [])).toMatchSnapshot();
  });

  test("generates index with explicit WHERE clause", () => {
    const indexes = [
      idx({
        keys: [{ key: "email", direction: "asc", nulls: null }],
        where: "deleted_at IS NULL",
      }),
    ];
    expect(generateIndexDDL(indexes, TABLE, NS, [])).toMatchSnapshot();
  });

  test("generates sparse index with auto WHERE IS NOT NULL", () => {
    const indexes = [
      idx({
        keys: [{ key: "phone", direction: "asc", nulls: null }],
        sparse: true,
      }),
    ];
    expect(generateIndexDDL(indexes, TABLE, NS, [])).toMatchSnapshot();
  });

  test("explicit WHERE takes precedence over sparse flag", () => {
    const indexes = [
      idx({
        keys: [{ key: "phone", direction: "asc", nulls: null }],
        where: "phone IS NOT NULL AND verified = true",
        sparse: true,
      }),
    ];
    const result = generateIndexDDL(indexes, TABLE, NS, []);
    expect(result[0]).toContain("WHERE phone IS NOT NULL AND verified = true");
    expect(result).toMatchSnapshot();
  });

  test("generates index with WITH storage parameters", () => {
    const indexes = [
      idx({
        keys: [{ key: "name", direction: "asc", nulls: null }],
        with: "fillfactor=70",
      }),
    ];
    expect(generateIndexDDL(indexes, TABLE, NS, [])).toMatchSnapshot();
  });

  test("uses schema-qualified table name when namespace is provided", () => {
    const indexes = [idx({ keys: [{ key: "email", direction: "asc", nulls: null }] })];
    const result = generateIndexDDL(indexes, TABLE, NS_SCOPED, []);
    expect(result[0]).toContain('"catalog"."products"');
    expect(result).toMatchSnapshot();
  });

  test("skips indexes where all directions are invalid (not asc/desc)", () => {
    const indexes = [
      idx({ keys: [{ key: "tags", direction: "text" as any, nulls: null }] }),
    ];
    expect(generateIndexDDL(indexes, TABLE, NS, [])).toEqual([]);
  });

  test("throws ProteusError when named index exceeds 63 characters", () => {
    const longName = "i".repeat(64);
    const indexes = [
      idx({ keys: [{ key: "email", direction: "asc", nulls: null }], name: longName }),
    ];
    expect(() => generateIndexDDL(indexes, TABLE, NS, [])).toThrow(ProteusError);
  });

  test("accepts a named index of exactly 63 characters", () => {
    const exactName = "j".repeat(63);
    const indexes = [
      idx({ keys: [{ key: "email", direction: "asc", nulls: null }], name: exactName }),
    ];
    expect(generateIndexDDL(indexes, TABLE, NS, [])).toMatchSnapshot();
  });

  test("throws ProteusError for an invalid USING method", () => {
    const indexes = [
      idx({
        keys: [{ key: "geom", direction: "asc", nulls: null }],
        using: "invalid_method",
      }),
    ];
    expect(() => generateIndexDDL(indexes, TABLE, NS, [])).toThrow(ProteusError);
  });

  test("generates index with both INCLUDE and WITH in correct order", () => {
    const indexes = [
      idx({
        keys: [{ key: "email", direction: "asc", nulls: null }],
        include: ["name"],
        with: "fillfactor=70",
      }),
    ];
    expect(generateIndexDDL(indexes, TABLE, NS, [])).toMatchSnapshot();
  });

  test("output for each index ends with a semicolon", () => {
    const indexes = [idx({ keys: [{ key: "email", direction: "asc", nulls: null }] })];
    const result = generateIndexDDL(indexes, TABLE, NS, []);
    expect(result[0].endsWith(";")).toBe(true);
  });

  test("auto-name starts with idx_", () => {
    const indexes = [idx({ keys: [{ key: "email", direction: "asc", nulls: null }] })];
    const result = generateIndexDDL(indexes, TABLE, NS, []);
    expect(result[0]).toMatch(/IF NOT EXISTS "idx_[A-Za-z0-9_-]{11}"/);
  });
});
