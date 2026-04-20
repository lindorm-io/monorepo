import type { EntityMetadata, MetaField } from "../../../entity/types/metadata";
import { compileProjection } from "./compile-projection";
import { describe, expect, test } from "vitest";

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

describe("compileProjection", () => {
  const metadata = makeMetadata([
    makeField("id"),
    makeField("name", "name"),
    makeField("email", "email_address"),
    makeField("age", "age"),
  ]);

  test("should return undefined for undefined select", () => {
    expect(compileProjection(undefined, metadata)).toBeUndefined();
  });

  test("should return undefined for empty select", () => {
    expect(compileProjection([], metadata)).toBeUndefined();
  });

  test("should include selected fields with value 1", () => {
    expect(compileProjection(["name", "age"], metadata)).toMatchSnapshot();
  });

  test("should map PK field to _id", () => {
    expect(compileProjection(["id", "name"], metadata)).toMatchSnapshot();
  });

  test("should always include _id even when not selected", () => {
    expect(compileProjection(["name"], metadata)).toMatchSnapshot();
  });

  test("should use metadata name for mapped fields", () => {
    expect(compileProjection(["email"], metadata)).toMatchSnapshot();
  });
});
