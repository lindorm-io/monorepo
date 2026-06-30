import { makeField } from "../../../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { NotSupportedError } from "../../../../../errors/index.js";
import { compileOrderBy } from "./compile-order-by.js";
import { describe, expect, test } from "vitest";

const metadata = {
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("age", { type: "integer" }),
  ],
  relations: [],
} as unknown as EntityMetadata;

describe("compileOrderBy", () => {
  test("should return empty string for null", () => {
    expect(compileOrderBy(null, metadata, "t0", [])).toBe("");
  });

  test("should compile single field ASC with NULLS LAST", () => {
    expect(compileOrderBy({ name: "ASC" }, metadata, "t0", [])).toMatchSnapshot();
  });

  test("should compile single field DESC with NULLS FIRST", () => {
    expect(compileOrderBy({ age: "DESC" }, metadata, "t0", [])).toMatchSnapshot();
  });

  test("should throw NotSupportedError for $similarity ordering", () => {
    expect(() =>
      compileOrderBy({ name: { $similarity: "beatles" } }, metadata, "t0", []),
    ).toThrow(NotSupportedError);
  });
});
