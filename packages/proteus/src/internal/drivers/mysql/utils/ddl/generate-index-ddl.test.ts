import { ProteusError } from "../../../../../errors";
import { makeField } from "../../../../__fixtures__/make-field";
import type { MetaIndex } from "#internal/entity/types/metadata";
import { generateIndexDDL } from "./generate-index-ddl";

const TABLE = "products";
const FIELDS = [
  makeField("email"),
  makeField("name"),
  makeField("createdAt", { type: "timestamp" }),
  makeField("slug"),
  makeField("tenant_id"),
  makeField("phone"),
  makeField("deletedAt", { type: "timestamp" }),
  makeField("tags", { type: "array" }),
  makeField("description", { type: "text" }),
  makeField("bio", { type: "url" }),
];

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

describe("generateIndexDDL (MySQL)", () => {
  test("returns empty array when no indexes are provided", () => {
    expect(generateIndexDDL([], TABLE, FIELDS)).toEqual([]);
  });

  test("generates a simple ASC index with auto-name", () => {
    const indexes = [idx({ keys: [{ key: "email", direction: "asc", nulls: null }] })];
    expect(generateIndexDDL(indexes, TABLE, FIELDS)).toMatchSnapshot();
  });

  test("generates a DESC index", () => {
    const indexes = [
      idx({ keys: [{ key: "createdAt", direction: "desc", nulls: null }] }),
    ];
    expect(generateIndexDDL(indexes, TABLE, FIELDS)).toMatchSnapshot();
  });

  test("generates a named index", () => {
    const indexes = [
      idx({ keys: [{ key: "name", direction: "asc", nulls: null }], name: "idx_name" }),
    ];
    expect(generateIndexDDL(indexes, TABLE, FIELDS)).toMatchSnapshot();
  });

  test("generates a UNIQUE index", () => {
    const indexes = [
      idx({ keys: [{ key: "slug", direction: "asc", nulls: null }], unique: true }),
    ];
    expect(generateIndexDDL(indexes, TABLE, FIELDS)).toMatchSnapshot();
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
    expect(generateIndexDDL(indexes, TABLE, FIELDS)).toMatchSnapshot();
  });

  test("does not include NULLS FIRST/LAST (unsupported in MySQL index DDL)", () => {
    const indexes = [
      idx({ keys: [{ key: "deletedAt", direction: "asc", nulls: "first" }] }),
    ];
    const result = generateIndexDDL(indexes, TABLE, FIELDS);
    expect(result[0]).not.toContain("NULLS");
    expect(result).toMatchSnapshot();
  });

  test("does not include IF NOT EXISTS (targeting MySQL 8.0.19+)", () => {
    const indexes = [idx({ keys: [{ key: "email", direction: "asc", nulls: null }] })];
    const result = generateIndexDDL(indexes, TABLE, FIELDS);
    expect(result[0]).not.toContain("IF NOT EXISTS");
  });

  test("adds warning for sparse index (unsupported in MySQL)", () => {
    const warnings: Array<string> = [];
    const indexes = [
      idx({
        keys: [{ key: "phone", direction: "asc", nulls: null }],
        sparse: true,
      }),
    ];
    generateIndexDDL(indexes, TABLE, FIELDS, warnings);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("partial/sparse");
  });

  test("adds warning for WHERE clause (unsupported in MySQL)", () => {
    const warnings: Array<string> = [];
    const indexes = [
      idx({
        keys: [{ key: "email", direction: "asc", nulls: null }],
        where: "deleted_at IS NULL",
      }),
    ];
    generateIndexDDL(indexes, TABLE, FIELDS, warnings);
    expect(warnings.length).toBeGreaterThan(0);
  });

  test("adds prefix length for TEXT column", () => {
    const indexes = [
      idx({ keys: [{ key: "description", direction: "asc", nulls: null }] }),
    ];
    const result = generateIndexDDL(indexes, TABLE, FIELDS);
    expect(result[0]).toContain("`description`(191)");
    expect(result).toMatchSnapshot();
  });

  test("adds prefix length for url (TEXT) column", () => {
    const indexes = [idx({ keys: [{ key: "bio", direction: "asc", nulls: null }] })];
    const result = generateIndexDDL(indexes, TABLE, FIELDS);
    expect(result[0]).toContain("`bio`(191)");
  });

  test("warns about JSON column indexing", () => {
    const warnings: Array<string> = [];
    const indexes = [idx({ keys: [{ key: "tags", direction: "asc", nulls: null }] })];
    generateIndexDDL(indexes, TABLE, FIELDS, warnings);
    expect(warnings.some((w) => w.includes("JSON"))).toBe(true);
  });

  test("throws when all directions are invalid", () => {
    const indexes = [
      idx({ keys: [{ key: "tags", direction: "text" as any, nulls: null }] }),
    ];
    expect(() => generateIndexDDL(indexes, TABLE, FIELDS)).toThrow(ProteusError);
  });

  test("throws ProteusError when named index exceeds 64 characters", () => {
    const longName = "i".repeat(65);
    const indexes = [
      idx({ keys: [{ key: "email", direction: "asc", nulls: null }], name: longName }),
    ];
    expect(() => generateIndexDDL(indexes, TABLE, FIELDS)).toThrow(ProteusError);
  });

  test("accepts a named index of exactly 64 characters", () => {
    const exactName = "j".repeat(64);
    const indexes = [
      idx({ keys: [{ key: "email", direction: "asc", nulls: null }], name: exactName }),
    ];
    expect(generateIndexDDL(indexes, TABLE, FIELDS)).toMatchSnapshot();
  });

  test("output for each index ends with a semicolon", () => {
    const indexes = [idx({ keys: [{ key: "email", direction: "asc", nulls: null }] })];
    const result = generateIndexDDL(indexes, TABLE, FIELDS);
    expect(result[0].endsWith(";")).toBe(true);
  });

  test("auto-name starts with idx_", () => {
    const indexes = [idx({ keys: [{ key: "email", direction: "asc", nulls: null }] })];
    const result = generateIndexDDL(indexes, TABLE, FIELDS);
    expect(result[0]).toMatch(/`idx_[A-Za-z0-9_-]{11}`/);
  });
});
