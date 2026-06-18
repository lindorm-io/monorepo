import { makeField } from "../../__fixtures__/make-field.js";
import { inferGeneratedTypes } from "./infer-generated-type.js";
import type { MetaGenerated } from "../types/metadata.js";
import { describe, expect, test } from "vitest";

const makeGenerated = (
  key: string,
  strategy: MetaGenerated["strategy"],
  overrides: Partial<MetaGenerated> = {},
): MetaGenerated => ({
  key,
  strategy,
  generator: null,
  length: null,
  max: null,
  min: null,
  namespace: null,
  ...overrides,
});

describe("inferGeneratedTypes", () => {
  test("should infer integer type for increment strategy", () => {
    const fields = [makeField("id", { type: null })];
    inferGeneratedTypes("Test", [makeGenerated("id", "increment")], fields);
    expect(fields[0].type).toBe("integer");
  });

  test("should infer integer type for integer strategy", () => {
    const fields = [makeField("id", { type: null })];
    inferGeneratedTypes("Test", [makeGenerated("id", "integer")], fields);
    expect(fields[0].type).toBe("integer");
  });

  test("should infer float type for float strategy", () => {
    const fields = [makeField("score", { type: null })];
    inferGeneratedTypes("Test", [makeGenerated("score", "float")], fields);
    expect(fields[0].type).toBe("float");
  });

  test("should infer uuid type for uuid strategy", () => {
    const fields = [makeField("id", { type: null })];
    inferGeneratedTypes("Test", [makeGenerated("id", "uuid")], fields);
    expect(fields[0].type).toBe("uuid");
  });

  test("should infer string type for string strategy", () => {
    const fields = [makeField("token", { type: null })];
    inferGeneratedTypes("Test", [makeGenerated("token", "string")], fields);
    expect(fields[0].type).toBe("string");
  });

  test("should infer timestamp type for date strategy", () => {
    const fields = [makeField("generatedAt", { type: null })];
    inferGeneratedTypes("Test", [makeGenerated("generatedAt", "date")], fields);
    expect(fields[0].type).toBe("timestamp");
  });

  test("should not change type when already set and compatible", () => {
    const fields = [makeField("id", { type: "uuid" })];
    inferGeneratedTypes("Test", [makeGenerated("id", "uuid")], fields);
    expect(fields[0].type).toBe("uuid");
  });

  test("should throw when generated field not in fields array", () => {
    const fields = [makeField("name", { type: "string" })];
    expect(() =>
      inferGeneratedTypes("Test", [makeGenerated("missing", "uuid")], fields),
    ).toThrow("Generated field not found");
  });

  test("should throw when strategy incompatible with existing type (date strategy on uuid)", () => {
    const fields = [makeField("id", { type: "uuid" })];
    expect(() =>
      inferGeneratedTypes("Test", [makeGenerated("id", "date")], fields),
    ).toThrow("Invalid @Generated strategy for field type");
  });

  test("should throw when strategy incompatible with existing type (uuid strategy on integer)", () => {
    const fields = [makeField("id", { type: "integer" })];
    expect(() =>
      inferGeneratedTypes("Test", [makeGenerated("id", "uuid")], fields),
    ).toThrow("Invalid @Generated strategy for field type");
  });

  test("should throw when strategy incompatible with existing type (float strategy on string)", () => {
    const fields = [makeField("name", { type: "string" })];
    expect(() =>
      inferGeneratedTypes("Test", [makeGenerated("name", "float")], fields),
    ).toThrow("Invalid @Generated strategy for field type");
  });

  test("should throw when strategy incompatible (string on integer)", () => {
    const fields = [makeField("id", { type: "integer" })];
    expect(() =>
      inferGeneratedTypes("Test", [makeGenerated("id", "string")], fields),
    ).toThrow("Invalid @Generated strategy for field type");
  });

  test("should throw when strategy incompatible (increment on string)", () => {
    const fields = [makeField("name", { type: "string" })];
    expect(() =>
      inferGeneratedTypes("Test", [makeGenerated("name", "increment")], fields),
    ).toThrow("Invalid @Generated strategy for field type");
  });

  test("should pass with compatible date strategy on timestamp field", () => {
    const fields = [makeField("createdAt", { type: "timestamp" })];
    expect(() =>
      inferGeneratedTypes("Test", [makeGenerated("createdAt", "date")], fields),
    ).not.toThrow();
  });

  test("should infer varchar(24) for lindorm_id strategy when type is null", () => {
    const fields = [makeField("id", { type: null })];
    inferGeneratedTypes("Test", [makeGenerated("id", "lindorm_id")], fields);
    expect(fields[0].type).toBe("varchar");
    expect(fields[0].max).toBe(24);
  });

  test("should compute varchar max from namespace for lindorm_id when type is null", () => {
    const fields = [makeField("id", { type: null })];
    inferGeneratedTypes(
      "Test",
      [makeGenerated("id", "lindorm_id", { namespace: "user" })],
      fields,
    );
    expect(fields[0].type).toBe("varchar");
    expect(fields[0].max).toBe(29);
  });

  test("should compute varchar max from length for lindorm_id when type is null", () => {
    const fields = [makeField("id", { type: null })];
    inferGeneratedTypes(
      "Test",
      [makeGenerated("id", "lindorm_id", { length: 32 })],
      fields,
    );
    expect(fields[0].type).toBe("varchar");
    expect(fields[0].max).toBe(32);
  });

  test("should accept lindorm_id on an existing varchar field and default max to 24", () => {
    const fields = [makeField("id", { type: "varchar", max: null })];
    inferGeneratedTypes("Test", [makeGenerated("id", "lindorm_id")], fields);
    expect(fields[0].type).toBe("varchar");
    expect(fields[0].max).toBe(24);
  });

  test("should not override an existing varchar max for lindorm_id", () => {
    const fields = [makeField("id", { type: "varchar", max: 128 })];
    inferGeneratedTypes("Test", [makeGenerated("id", "lindorm_id")], fields);
    expect(fields[0].max).toBe(128);
  });

  test("should throw when @Max is too small to hold a lindorm_id", () => {
    const fields = [makeField("id", { type: "varchar", max: 10 })];
    expect(() =>
      inferGeneratedTypes("Test", [makeGenerated("id", "lindorm_id")], fields),
    ).toThrow("Invalid @Max for lindorm_id field");
  });

  test("should throw when @Max is too small for a namespaced lindorm_id", () => {
    const fields = [makeField("id", { type: "varchar", max: 24 })];
    expect(() =>
      inferGeneratedTypes(
        "Test",
        [makeGenerated("id", "lindorm_id", { namespace: "user" })],
        fields,
      ),
    ).toThrow("Invalid @Max for lindorm_id field");
  });

  test("should accept lindorm_id on string and text field types", () => {
    const stringFields = [makeField("a", { type: "string" })];
    const textFields = [makeField("b", { type: "text" })];
    expect(() =>
      inferGeneratedTypes("Test", [makeGenerated("a", "lindorm_id")], stringFields),
    ).not.toThrow();
    expect(() =>
      inferGeneratedTypes("Test", [makeGenerated("b", "lindorm_id")], textFields),
    ).not.toThrow();
  });

  test("should throw when lindorm_id strategy used on incompatible field type", () => {
    const fields = [makeField("id", { type: "integer" })];
    expect(() =>
      inferGeneratedTypes("Test", [makeGenerated("id", "lindorm_id")], fields),
    ).toThrow("Invalid @Generated strategy for field type");
  });

  test("should skip type inference for function generators with an explicit type", () => {
    const fields = [makeField("id", { type: "varchar", max: 32 })];
    inferGeneratedTypes(
      "Test",
      [makeGenerated("id", null, { generator: () => "x" })],
      fields,
    );
    expect(fields[0].type).toBe("varchar");
    expect(fields[0].max).toBe(32);
  });

  test("should throw when a function generator has no explicit field type", () => {
    const fields = [makeField("id", { type: null })];
    expect(() =>
      inferGeneratedTypes(
        "Test",
        [makeGenerated("id", null, { generator: () => "x" })],
        fields,
      ),
    ).toThrow("Invalid @Generated strategy for field type");
  });

  test("should fall back a null-type field (no @Generated) to VARCHAR(255)", () => {
    const fields = [makeField("id", { type: null })];
    inferGeneratedTypes("Test", [], fields);
    expect(fields[0].type).toBe("varchar");
    expect(fields[0].max).toBe(255);
  });

  test("should throw when two @Generated entries target the same field key", () => {
    const fields = [makeField("id", { type: null })];
    expect(() =>
      inferGeneratedTypes(
        "Test",
        [makeGenerated("id", "uuid"), makeGenerated("id", "lindorm_id")],
        fields,
      ),
    ).toThrow("Duplicate @Generated for field");
  });
});
