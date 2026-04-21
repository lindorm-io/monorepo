import type { MetaField, MetaGenerated } from "../types/metadata";
import { validateGenerated } from "./validate-generated";
import { describe, expect, it } from "vitest";

const makeField = (overrides: Partial<MetaField> & { key: string }): MetaField => ({
  decorator: "Field",
  default: null,
  enum: null,
  max: null,
  min: null,
  nullable: false,
  optional: false,
  schema: null,
  transform: null,
  type: "string",
  ...overrides,
});

const makeGenerated = (
  overrides: Partial<MetaGenerated> & Pick<MetaGenerated, "key" | "strategy">,
): MetaGenerated => ({
  length: null,
  max: null,
  min: null,
  ...overrides,
});

describe("validateGenerated", () => {
  it("should pass for valid generated with matching field type", () => {
    const fields = [makeField({ key: "id", type: "uuid" })];
    const generated = [makeGenerated({ key: "id", strategy: "uuid" })];

    expect(() => validateGenerated("TestMsg", generated, fields)).not.toThrow();
  });

  it("should throw when generated key has no matching field", () => {
    const fields = [makeField({ key: "name" })];
    const generated = [makeGenerated({ key: "missing", strategy: "uuid" })];

    expect(() => validateGenerated("TestMsg", generated, fields)).toThrow(
      "Generated field not found",
    );
  });

  it("should throw on strategy/type mismatch (uuid strategy on integer field)", () => {
    const fields = [makeField({ key: "id", type: "integer" })];
    const generated = [makeGenerated({ key: "id", strategy: "uuid" })];

    expect(() => validateGenerated("TestMsg", generated, fields)).toThrow(
      "Invalid @Generated strategy for field type",
    );
  });

  it("should throw on strategy/type mismatch (date strategy on string field)", () => {
    const fields = [makeField({ key: "ts", type: "string" })];
    const generated = [makeGenerated({ key: "ts", strategy: "date" })];

    expect(() => validateGenerated("TestMsg", generated, fields)).toThrow(
      "Invalid @Generated strategy for field type",
    );
  });

  it("should throw on strategy/type mismatch (integer strategy on uuid field)", () => {
    const fields = [makeField({ key: "count", type: "uuid" })];
    const generated = [makeGenerated({ key: "count", strategy: "integer" })];

    expect(() => validateGenerated("TestMsg", generated, fields)).toThrow(
      "Invalid @Generated strategy for field type",
    );
  });

  it("should pass when field type matches strategy type (date)", () => {
    const fields = [makeField({ key: "ts", type: "date" })];
    const generated = [makeGenerated({ key: "ts", strategy: "date" })];

    expect(() => validateGenerated("TestMsg", generated, fields)).not.toThrow();
  });

  it("should pass when field type matches strategy type (string)", () => {
    const fields = [makeField({ key: "code", type: "string" })];
    const generated = [makeGenerated({ key: "code", strategy: "string" })];

    expect(() => validateGenerated("TestMsg", generated, fields)).not.toThrow();
  });

  it("should pass when field type matches strategy type (integer)", () => {
    const fields = [makeField({ key: "seq", type: "integer" })];
    const generated = [makeGenerated({ key: "seq", strategy: "integer" })];

    expect(() => validateGenerated("TestMsg", generated, fields)).not.toThrow();
  });

  it("should pass when field type matches strategy type (float)", () => {
    const fields = [makeField({ key: "score", type: "float" })];
    const generated = [makeGenerated({ key: "score", strategy: "float" })];

    expect(() => validateGenerated("TestMsg", generated, fields)).not.toThrow();
  });
});
