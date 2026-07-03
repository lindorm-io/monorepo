import { makeField } from "../../../../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../../../../entity/types/metadata.js";
import { NotSupportedError, ProteusError } from "../../../../../../errors/index.js";
import { compileOrderBy } from "../compile-order-by.js";
import { describe, expect, test } from "vitest";

const metadata = {
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("email", { type: "string", name: "email_address" }),
    makeField("age", { type: "integer" }),
  ],
  relations: [],
} as unknown as EntityMetadata;

describe("compileOrderBy", () => {
  test("should return empty string for null", () => {
    expect(compileOrderBy(null, metadata, "t0", [])).toBe("");
  });

  test("should return empty string for empty object", () => {
    expect(compileOrderBy({}, metadata, "t0", [])).toBe("");
  });

  test("should compile single field ASC with NULLS LAST emulation", () => {
    const result = compileOrderBy({ name: "ASC" }, metadata, "t0", []);
    expect(result).toMatchSnapshot();
    // Should use IS NULL trick for NULLS LAST
    expect(result).toContain("IS NULL");
  });

  test("should compile single field DESC with NULLS FIRST emulation", () => {
    const result = compileOrderBy({ age: "DESC" }, metadata, "t0", []);
    expect(result).toMatchSnapshot();
    // Should use IS NOT NULL trick for NULLS FIRST
    expect(result).toContain("IS NOT NULL");
  });

  test("should compile multiple fields", () => {
    expect(
      compileOrderBy({ name: "ASC", age: "DESC" }, metadata, "t0", []),
    ).toMatchSnapshot();
  });

  test("should use column name mapping", () => {
    expect(compileOrderBy({ email: "ASC" }, metadata, "t0", [])).toMatchSnapshot();
  });

  test("should throw ProteusError for unknown field key", () => {
    expect(() =>
      compileOrderBy({ nonexistent: "ASC" } as any, metadata, "t0", []),
    ).toThrow(ProteusError);
  });

  test("should throw NotSupportedError for $similarity ordering", () => {
    expect(() =>
      compileOrderBy({ name: { $similarity: "beatles" } }, metadata, "t0", []),
    ).toThrow(NotSupportedError);
  });

  // --- Raw ORDER BY ---

  test("should emit ORDER BY for a raw-only fragment with no field terms", () => {
    const params: Array<unknown> = [];
    const result = compileOrderBy(null, metadata, "t0", params, [
      { sql: "n DESC", params: [] },
    ]);
    expect(result).toMatchSnapshot();
    expect(params).toEqual([]);
  });

  test("should append multiple raw fragments in insertion order", () => {
    const result = compileOrderBy(
      null,
      metadata,
      "t0",
      [],
      [
        { sql: "n DESC", params: [] },
        { sql: "name ASC", params: [] },
      ],
    );
    expect(result).toMatchSnapshot();
  });

  test("should emit field terms (with NULLS emulation) first, then raw terms", () => {
    const result = compileOrderBy(
      { name: "ASC" },
      metadata,
      "t0",
      [],
      [{ sql: "n DESC", params: [] }],
    );
    expect(result).toMatchSnapshot();
  });

  test("should append raw fragment params positionally after existing params", () => {
    const params: Array<unknown> = ["pre-existing"];
    const result = compileOrderBy({ name: "ASC" }, metadata, "t0", params, [
      { sql: "score > ? DESC", params: [10] },
    ]);
    // MySQL uses positional `?`; params are appended in order, text unchanged
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["pre-existing", 10]);
  });
});
