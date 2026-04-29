import { makeField } from "../../../../__fixtures__/make-field.js";
import { ProteusError } from "../../../../../errors/index.js";
import { generateEnumTypeDDL } from "./generate-enum-type-ddl.js";
import { describe, expect, test } from "vitest";

// ---------------------------------------------------------------------------
// Sample enums
// ---------------------------------------------------------------------------

enum StringStatus {
  Active = "active",
  Inactive = "inactive",
  Pending = "pending",
}

enum NumericPriority {
  Low,
  Medium,
  High,
}

const TABLE = "orders";
const NS = null;
const NS_SCOPED = "billing";

describe("generateEnumTypeDDL", () => {
  test("returns empty array when no fields have enum type", () => {
    const fields = [makeField("name", { type: "string" })];
    expect(generateEnumTypeDDL(fields, TABLE, NS)).toEqual([]);
  });

  test("generates idempotent DO $$ block for a string enum", () => {
    const fields = [makeField("status", { type: "enum", enum: StringStatus })];
    expect(generateEnumTypeDDL(fields, TABLE, NS)).toMatchSnapshot();
  });

  test("generates correct enum type for a numeric (non-string-valued) enum", () => {
    const fields = [makeField("priority", { type: "enum", enum: NumericPriority })];
    expect(generateEnumTypeDDL(fields, TABLE, NS)).toMatchSnapshot();
  });

  test("generates schema-qualified enum type name when namespace is provided", () => {
    const fields = [makeField("status", { type: "enum", enum: StringStatus })];
    expect(generateEnumTypeDDL(fields, TABLE, NS_SCOPED)).toMatchSnapshot();
  });

  test("generates DDL for multiple enum fields", () => {
    const fields = [
      makeField("status", { type: "enum", enum: StringStatus }),
      makeField("priority", { type: "enum", enum: NumericPriority }),
    ];
    expect(generateEnumTypeDDL(fields, TABLE, NS)).toMatchSnapshot();
  });

  test("skips non-enum fields in a mixed list", () => {
    const fields = [
      makeField("name", { type: "string" }),
      makeField("status", { type: "enum", enum: StringStatus }),
      makeField("age", { type: "integer" }),
    ];
    const result = generateEnumTypeDDL(fields, TABLE, NS);
    expect(result).toHaveLength(1);
    expect(result).toMatchSnapshot();
  });

  test("escapes single quotes in enum values", () => {
    const dirtyEnum = { "it's here": "it's here" };
    const fields = [makeField("label", { type: "enum", enum: dirtyEnum })];
    expect(generateEnumTypeDDL(fields, TABLE, NS)).toMatchSnapshot();
  });

  test("throws ProteusError when field has enum values but type is not 'enum'", () => {
    const fields = [makeField("status", { type: "string", enum: StringStatus })];
    expect(() => generateEnumTypeDDL(fields, TABLE, NS)).toThrow(ProteusError);
  });

  test("throws ProteusError when field type is 'enum' but enum is null", () => {
    const fields = [makeField("status", { type: "enum", enum: null })];
    expect(() => generateEnumTypeDDL(fields, TABLE, NS)).toThrow(ProteusError);
  });

  test("throws ProteusError when enum definition is not an object", () => {
    const fields = [makeField("status", { type: "enum", enum: "not-an-enum" as any })];
    expect(() => generateEnumTypeDDL(fields, TABLE, NS)).toThrow(ProteusError);
  });

  test("throws ProteusError when enum object is empty (no values)", () => {
    const fields = [makeField("status", { type: "enum", enum: {} })];
    expect(() => generateEnumTypeDDL(fields, TABLE, NS)).toThrow(ProteusError);
  });
});
