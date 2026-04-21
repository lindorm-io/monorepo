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
    expect(compileOrderBy(null, metadata, "t0")).toBe("");
  });

  test("should return empty string for empty object", () => {
    expect(compileOrderBy({}, metadata, "t0")).toBe("");
  });

  test("should compile single field ASC", () => {
    expect(compileOrderBy({ name: "ASC" }, metadata, "t0")).toMatchSnapshot();
  });

  test("should compile single field DESC", () => {
    expect(compileOrderBy({ age: "DESC" }, metadata, "t0")).toMatchSnapshot();
  });

  test("should compile multiple fields", () => {
    expect(
      compileOrderBy({ name: "ASC", age: "DESC" }, metadata, "t0"),
    ).toMatchSnapshot();
  });

  test("should use column name mapping", () => {
    expect(compileOrderBy({ email: "ASC" }, metadata, "t0")).toMatchSnapshot();
  });

  test("should throw ProteusError for unknown field key", () => {
    // resolveColumnName throws ProteusError when the key is not found in metadata fields
    expect(() => compileOrderBy({ nonexistent: "ASC" } as any, metadata, "t0")).toThrow(
      ProteusError,
    );
  });

  test("should include unknown field key in error message", () => {
    expect(() => compileOrderBy({ nonexistent: "ASC" } as any, metadata, "t0")).toThrow(
      /"nonexistent" not found/,
    );
  });
});
