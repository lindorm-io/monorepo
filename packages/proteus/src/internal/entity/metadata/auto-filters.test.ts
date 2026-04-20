import { describe, expect, test } from "vitest";
import { makeField } from "../../__fixtures__/make-field";
import {
  generateAutoFilters,
  SCOPE_FILTER_NAME,
  SOFT_DELETE_FILTER_NAME,
  sortScopeFields,
} from "./auto-filters";

describe("generateAutoFilters", () => {
  test("should return empty array when no DeleteDate or Scope field is present", () => {
    const fields = [
      makeField("id"),
      makeField("name"),
      makeField("createdAt", { decorator: "CreateDate" }),
    ];

    expect(generateAutoFilters(fields)).toEqual([]);
  });

  test("should return __softDelete filter when DeleteDate field is present", () => {
    const fields = [makeField("id"), makeField("deletedAt", { decorator: "DeleteDate" })];

    const result = generateAutoFilters(fields);

    expect(result).toEqual([
      {
        name: "__softDelete",
        condition: { deletedAt: null },
        default: true,
      },
    ]);
  });

  test("should use the correct key from the DeleteDate field", () => {
    const fields = [makeField("id"), makeField("removedAt", { decorator: "DeleteDate" })];

    const result = generateAutoFilters(fields);

    expect(result).toEqual([
      {
        name: SOFT_DELETE_FILTER_NAME,
        condition: { removedAt: null },
        default: true,
      },
    ]);
  });

  test("should only generate one __softDelete filter even with multiple fields", () => {
    const fields = [
      makeField("id"),
      makeField("name"),
      makeField("deletedAt", { decorator: "DeleteDate" }),
      makeField("updatedAt", { decorator: "UpdateDate" }),
      makeField("createdAt", { decorator: "CreateDate" }),
    ];

    const result = generateAutoFilters(fields);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("__softDelete");
  });

  test("should return empty array for empty fields array", () => {
    expect(generateAutoFilters([])).toEqual([]);
  });

  test("should export SOFT_DELETE_FILTER_NAME as __softDelete", () => {
    expect(SOFT_DELETE_FILTER_NAME).toBe("__softDelete");
  });

  test("should export SCOPE_FILTER_NAME as __scope", () => {
    expect(SCOPE_FILTER_NAME).toBe("__scope");
  });
});

describe("generateAutoFilters — __scope", () => {
  test("should generate __scope filter for a single scope field", () => {
    const fields = [makeField("id"), makeField("tenantId", { decorator: "Scope" })];

    const result = generateAutoFilters(fields);

    expect(result).toEqual([
      {
        name: SCOPE_FILTER_NAME,
        condition: { tenantId: "$tenantId" },
        default: true,
      },
    ]);
  });

  test("should generate __scope filter with $and for multiple scope fields", () => {
    const fields = [
      makeField("id"),
      makeField("tenantId", { decorator: "Scope" }),
      makeField("region", { decorator: "Scope" }),
    ];

    const result = generateAutoFilters(fields);

    const scopeFilter = result.find((f) => f.name === SCOPE_FILTER_NAME);
    expect(scopeFilter).toBeDefined();
    expect(scopeFilter!.condition).toEqual({
      $and: [{ region: "$region" }, { tenantId: "$tenantId" }],
    });
    expect(scopeFilter!.default).toBe(true);
  });

  test("should order scope fields by explicit order, then alphabetically", () => {
    const fields = [
      makeField("id"),
      makeField("tenantId", { decorator: "Scope", order: 2 }),
      makeField("region", { decorator: "Scope", order: 1 }),
      makeField("env", { decorator: "Scope" }),
    ];

    const result = generateAutoFilters(fields);
    const scopeFilter = result.find((f) => f.name === SCOPE_FILTER_NAME);

    expect(scopeFilter!.condition).toEqual({
      $and: [{ region: "$region" }, { tenantId: "$tenantId" }, { env: "$env" }],
    });
  });

  test("should generate both __softDelete and __scope when both exist", () => {
    const fields = [
      makeField("id"),
      makeField("deletedAt", { decorator: "DeleteDate" }),
      makeField("tenantId", { decorator: "Scope" }),
    ];

    const result = generateAutoFilters(fields);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe(SOFT_DELETE_FILTER_NAME);
    expect(result[1].name).toBe(SCOPE_FILTER_NAME);
  });

  test("should not generate __scope filter when no scope fields exist", () => {
    const fields = [makeField("id"), makeField("name")];

    const result = generateAutoFilters(fields);
    expect(result.find((f) => f.name === SCOPE_FILTER_NAME)).toBeUndefined();
  });
});

describe("sortScopeFields", () => {
  test("should sort by explicit order first, then alphabetically", () => {
    const fields = [
      makeField("zebra", { decorator: "Scope" }),
      makeField("beta", { decorator: "Scope", order: 2 }),
      makeField("alpha", { decorator: "Scope", order: 1 }),
      makeField("gamma", { decorator: "Scope" }),
    ];

    const sorted = sortScopeFields(fields);
    expect(sorted.map((f) => f.key)).toEqual(["alpha", "beta", "gamma", "zebra"]);
  });

  test("should handle all explicitly ordered fields", () => {
    const fields = [
      makeField("c", { decorator: "Scope", order: 3 }),
      makeField("a", { decorator: "Scope", order: 1 }),
      makeField("b", { decorator: "Scope", order: 2 }),
    ];

    const sorted = sortScopeFields(fields);
    expect(sorted.map((f) => f.key)).toEqual(["a", "b", "c"]);
  });

  test("should handle all unordered fields alphabetically", () => {
    const fields = [
      makeField("region", { decorator: "Scope" }),
      makeField("env", { decorator: "Scope" }),
      makeField("tenantId", { decorator: "Scope" }),
    ];

    const sorted = sortScopeFields(fields);
    expect(sorted.map((f) => f.key)).toEqual(["env", "region", "tenantId"]);
  });

  test("should return empty array for empty input", () => {
    expect(sortScopeFields([])).toEqual([]);
  });

  test("should handle single field", () => {
    const fields = [makeField("scope", { decorator: "Scope" })];
    const sorted = sortScopeFields(fields);
    expect(sorted.map((f) => f.key)).toEqual(["scope"]);
  });
});
