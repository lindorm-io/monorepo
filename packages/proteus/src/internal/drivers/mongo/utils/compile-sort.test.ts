import type { EntityMetadata, MetaField } from "#internal/entity/types/metadata";
import { compileSort } from "./compile-sort";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeField = (key: string, name?: string): MetaField =>
  ({
    key,
    name: name ?? key,
    type: "string",
  }) as unknown as MetaField;

const makeMetadata = (
  fields: Array<MetaField>,
  primaryKeys: Array<string> = ["id"],
): EntityMetadata =>
  ({
    entity: { name: "TestEntity" },
    fields,
    primaryKeys,
  }) as unknown as EntityMetadata;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("compileSort", () => {
  const metadata = makeMetadata([
    makeField("id"),
    makeField("name", "name"),
    makeField("age", "age"),
    makeField("email", "email_address"),
  ]);

  test("should return undefined for undefined orderBy", () => {
    expect(compileSort(undefined, metadata)).toBeUndefined();
  });

  test("should return undefined for empty orderBy", () => {
    expect(compileSort({}, metadata)).toBeUndefined();
  });

  test("should compile single field ascending", () => {
    expect(compileSort({ name: "ASC" }, metadata)).toMatchSnapshot();
  });

  test("should compile single field descending", () => {
    expect(compileSort({ name: "DESC" }, metadata)).toMatchSnapshot();
  });

  test("should compile multiple fields", () => {
    expect(compileSort({ name: "ASC", age: "DESC" }, metadata)).toMatchSnapshot();
  });

  test("should map PK field to _id", () => {
    expect(compileSort({ id: "ASC" }, metadata)).toMatchSnapshot();
  });

  test("should use metadata name for mapped fields", () => {
    expect(compileSort({ email: "ASC" }, metadata)).toMatchSnapshot();
  });

  test("should handle compound PK mapping", () => {
    const compoundMeta = makeMetadata(
      [makeField("tenantId"), makeField("userId"), makeField("name")],
      ["tenantId", "userId"],
    );

    expect(
      compileSort({ tenantId: "ASC", name: "DESC" }, compoundMeta),
    ).toMatchSnapshot();
  });
});
