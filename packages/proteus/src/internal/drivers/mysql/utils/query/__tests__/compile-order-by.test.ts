import { makeField } from "../../../../../__fixtures__/make-field";
import type { EntityMetadata } from "../../../../../entity/types/metadata";
import { ProteusError } from "../../../../../../errors";
import { compileOrderBy } from "../compile-order-by";

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
    expect(compileOrderBy(null, metadata, "t0")).toBe("");
  });

  test("should return empty string for empty object", () => {
    expect(compileOrderBy({}, metadata, "t0")).toBe("");
  });

  test("should compile single field ASC with NULLS LAST emulation", () => {
    const result = compileOrderBy({ name: "ASC" }, metadata, "t0");
    expect(result).toMatchSnapshot();
    // Should use IS NULL trick for NULLS LAST
    expect(result).toContain("IS NULL");
  });

  test("should compile single field DESC with NULLS FIRST emulation", () => {
    const result = compileOrderBy({ age: "DESC" }, metadata, "t0");
    expect(result).toMatchSnapshot();
    // Should use IS NOT NULL trick for NULLS FIRST
    expect(result).toContain("IS NOT NULL");
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
    expect(() => compileOrderBy({ nonexistent: "ASC" } as any, metadata, "t0")).toThrow(
      ProteusError,
    );
  });
});
