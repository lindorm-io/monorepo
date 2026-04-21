import type { MetaField } from "../types/metadata.js";
import { validateFields } from "./validate-fields.js";
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

describe("validateFields", () => {
  it("should pass for valid fields", () => {
    const fields = [
      makeField({ key: "id", decorator: "IdentifierField", type: "uuid" }),
      makeField({ key: "name" }),
      makeField({ key: "createdAt", decorator: "TimestampField", type: "date" }),
    ];

    expect(() => validateFields("TestMsg", fields)).not.toThrow();
  });

  it("should throw on duplicate field keys", () => {
    const fields = [makeField({ key: "name" }), makeField({ key: "name" })];

    expect(() => validateFields("TestMsg", fields)).toThrow("Duplicate field metadata");
  });

  it("should throw on duplicate unique decorator (IdentifierField)", () => {
    const fields = [
      makeField({ key: "id1", decorator: "IdentifierField", type: "uuid" }),
      makeField({ key: "id2", decorator: "IdentifierField", type: "uuid" }),
    ];

    expect(() => validateFields("TestMsg", fields)).toThrow(
      "Duplicate unique field type",
    );
  });

  it("should throw on duplicate unique decorator (TimestampField)", () => {
    const fields = [
      makeField({ key: "ts1", decorator: "TimestampField", type: "date" }),
      makeField({ key: "ts2", decorator: "TimestampField", type: "date" }),
    ];

    expect(() => validateFields("TestMsg", fields)).toThrow(
      "Duplicate unique field type",
    );
  });

  it("should allow multiple plain Field decorators", () => {
    const fields = [
      makeField({ key: "a" }),
      makeField({ key: "b" }),
      makeField({ key: "c" }),
    ];

    expect(() => validateFields("TestMsg", fields)).not.toThrow();
  });

  it("should allow one of each unique decorator", () => {
    const fields = [
      makeField({ key: "id", decorator: "IdentifierField", type: "uuid" }),
      makeField({ key: "ts", decorator: "TimestampField", type: "date" }),
      makeField({ key: "corr", decorator: "CorrelationField", type: "uuid" }),
      makeField({ key: "mand", decorator: "MandatoryField", type: "string" }),
      makeField({ key: "pers", decorator: "PersistentField", type: "string" }),
    ];

    expect(() => validateFields("TestMsg", fields)).not.toThrow();
  });
});
