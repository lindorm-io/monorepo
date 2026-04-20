import { makeField } from "../../__fixtures__/make-field";
import { inferGeneratedTypes } from "./infer-generated-type";
import type { MetaGenerated } from "../types/metadata";
import { describe, expect, test } from "vitest";

const makeGenerated = (
  key: string,
  strategy: MetaGenerated["strategy"],
): MetaGenerated => ({
  key,
  strategy,
  length: null,
  max: null,
  min: null,
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
});
