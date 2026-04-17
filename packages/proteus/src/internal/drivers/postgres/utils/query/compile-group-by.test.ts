import { makeField } from "../../../../__fixtures__/make-field";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import { compileGroupBy } from "./compile-group-by";

const metadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "orders",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("status", { type: "string" }),
    makeField("category", { type: "string", name: "category_name" }),
    makeField("amount", { type: "float" }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

describe("compileGroupBy", () => {
  test("should return empty string for null", () => {
    expect(compileGroupBy(null, metadata, "t0")).toBe("");
  });

  test("should return empty string for empty array", () => {
    expect(compileGroupBy([], metadata, "t0")).toBe("");
  });

  test("should compile single field", () => {
    expect(compileGroupBy(["status"], metadata, "t0")).toMatchSnapshot();
  });

  test("should compile multiple fields", () => {
    expect(compileGroupBy(["status", "amount"], metadata, "t0")).toMatchSnapshot();
  });

  test("should use column name when key differs from column name", () => {
    expect(compileGroupBy(["category"], metadata, "t0")).toMatchSnapshot();
  });

  test("should use the provided table alias", () => {
    expect(compileGroupBy(["status"], metadata, "orders")).toMatchSnapshot();
  });

  test("should throw when field key is not in metadata", () => {
    expect(() =>
      compileGroupBy(["nonexistent" as keyof typeof metadata], metadata, "t0"),
    ).toThrow();
  });
});
