import { makeField } from "../../__fixtures__/make-field";
import type { MetaFilter } from "../types/metadata";
import { validateFilters } from "./validate-filters";

const fields = [
  makeField("id", { type: "uuid" }),
  makeField("status", { type: "string" }),
  makeField("tenantId", { type: "string" }),
  makeField("amount", { type: "float" }),
];

describe("validateFilters", () => {
  test("should pass with valid field references", () => {
    const filters: Array<MetaFilter> = [
      { name: "active", condition: { status: "active" }, default: true },
    ];
    expect(() => validateFilters("TestEntity", filters, fields)).not.toThrow();
  });

  test("should pass with parameterized field references", () => {
    const filters: Array<MetaFilter> = [
      { name: "tenant", condition: { tenantId: "$tenantId" }, default: false },
    ];
    expect(() => validateFilters("TestEntity", filters, fields)).not.toThrow();
  });

  test("should pass with operator conditions", () => {
    const filters: Array<MetaFilter> = [
      {
        name: "highValue",
        condition: { amount: { $gte: "$minAmount" } },
        default: false,
      },
    ];
    expect(() => validateFilters("TestEntity", filters, fields)).not.toThrow();
  });

  test("should pass with $and/$or conditions", () => {
    const filters: Array<MetaFilter> = [
      {
        name: "complex",
        condition: {
          $or: [{ status: "active" }, { amount: { $gt: 100 } }],
        },
        default: false,
      },
    ];
    expect(() => validateFilters("TestEntity", filters, fields)).not.toThrow();
  });

  test("should throw for unknown field reference", () => {
    const filters: Array<MetaFilter> = [
      { name: "bad", condition: { unknownField: "value" }, default: false },
    ];
    expect(() => validateFilters("TestEntity", filters, fields)).toThrow(
      '@Filter("bad") references unknown field "unknownField"',
    );
  });

  test("should throw for unknown field in nested $or", () => {
    const filters: Array<MetaFilter> = [
      {
        name: "badNested",
        condition: {
          $or: [{ status: "active" }, { nonExistent: "value" }],
        },
        default: false,
      },
    ];
    expect(() => validateFilters("TestEntity", filters, fields)).toThrow(
      '@Filter("badNested") references unknown field "nonExistent"',
    );
  });

  test("should throw for duplicate filter names", () => {
    const filters: Array<MetaFilter> = [
      { name: "active", condition: { status: "active" }, default: true },
      { name: "active", condition: { status: "enabled" }, default: false },
    ];
    expect(() => validateFilters("TestEntity", filters, fields)).toThrow(
      'Duplicate @Filter name "active"',
    );
  });

  test("should pass with empty filters array", () => {
    expect(() => validateFilters("TestEntity", [], fields)).not.toThrow();
  });

  test("should pass with multiple valid filters", () => {
    const filters: Array<MetaFilter> = [
      { name: "active", condition: { status: "active" }, default: true },
      { name: "tenant", condition: { tenantId: "$tenantId" }, default: false },
      { name: "highValue", condition: { amount: { $gte: 1000 } }, default: false },
    ];
    expect(() => validateFilters("TestEntity", filters, fields)).not.toThrow();
  });

  test("should pass with $not condition", () => {
    const filters: Array<MetaFilter> = [
      { name: "notDraft", condition: { $not: { status: "draft" } }, default: true },
    ];
    expect(() => validateFilters("TestEntity", filters, fields)).not.toThrow();
  });
});
