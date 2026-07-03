import { makeField } from "../../../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { ProteusError } from "../../../../../errors/index.js";
import { compileOrderBy } from "./compile-order-by.js";
import { describe, expect, test } from "vitest";

const metadata = {
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("email", { type: "string", name: "email_address" }),
    makeField("age", { type: "integer" }),
  ],
} as EntityMetadata;

describe("compileOrderBy", () => {
  test("should return empty string for null", () => {
    expect(compileOrderBy(null, metadata, "t0", [])).toBe("");
  });

  test("should return empty string for empty object", () => {
    expect(compileOrderBy({}, metadata, "t0", [])).toBe("");
  });

  test("should compile single field ASC", () => {
    expect(compileOrderBy({ name: "ASC" }, metadata, "t0", [])).toMatchSnapshot();
  });

  test("should compile single field DESC", () => {
    expect(compileOrderBy({ age: "DESC" }, metadata, "t0", [])).toMatchSnapshot();
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
    // resolveColumnName throws ProteusError when the key is not found in metadata fields
    expect(() =>
      compileOrderBy({ nonexistent: "ASC" } as any, metadata, "t0", []),
    ).toThrow(ProteusError);
  });

  test("should include unknown field key in error message", () => {
    expect(() =>
      compileOrderBy({ nonexistent: "ASC" } as any, metadata, "t0", []),
    ).toThrow(/"nonexistent" not found/);
  });

  test("should compile $similarity order (default DESC) and push the value", () => {
    const params: Array<unknown> = [];
    const result = compileOrderBy(
      { name: { $similarity: "beatles" } },
      metadata,
      "t0",
      params,
    );
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["beatles"]);
  });

  test("should compile $similarity order with explicit dir ASC", () => {
    const params: Array<unknown> = [];
    const result = compileOrderBy(
      { name: { $similarity: "beatles", dir: "ASC" } },
      metadata,
      "t0",
      params,
    );
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["beatles"]);
  });

  test("should mix $similarity and plain column order, preserving param positions", () => {
    const params: Array<unknown> = ["pre-existing"];
    const result = compileOrderBy(
      { name: { $similarity: "beatles", dir: "DESC" }, age: "ASC" },
      metadata,
      "t0",
      params,
    );
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["pre-existing", "beatles"]);
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

  test("should emit field terms first, then raw terms", () => {
    const result = compileOrderBy(
      { name: "ASC" },
      metadata,
      "t0",
      [],
      [{ sql: "n DESC", params: [] }],
    );
    expect(result).toMatchSnapshot();
  });

  test("should reindex raw fragment $N placeholders past existing params", () => {
    const params: Array<unknown> = ["pre-existing"];
    const result = compileOrderBy({ name: "ASC" }, metadata, "t0", params, [
      { sql: "score > $1 DESC", params: [10] },
    ]);
    // $1 in the fragment must become $2 because one param already precedes it
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["pre-existing", 10]);
  });

  test("should order $similarity params before raw fragment params", () => {
    const params: Array<unknown> = [];
    const result = compileOrderBy(
      { name: { $similarity: "beatles" } },
      metadata,
      "t0",
      params,
      [{ sql: "score > $1 DESC", params: [10] }],
    );
    // similarity pushes "beatles" as $1, so the raw fragment's $1 reindexes to $2
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["beatles", 10]);
  });
});
