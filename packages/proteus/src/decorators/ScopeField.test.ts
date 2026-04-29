import { SCOPE_FILTER_NAME } from "../internal/entity/metadata/auto-filters.js";
import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { Entity } from "./Entity.js";
import { PrimaryKeyField } from "./PrimaryKeyField.js";
import { ScopeField } from "./ScopeField.js";
import { describe, expect, test } from "vitest";

@Entity({ name: "ScopeFieldDecorated" })
class ScopeFieldDecorated {
  @PrimaryKeyField()
  id!: string;

  @ScopeField()
  scope!: string;
}

@Entity({ name: "ScopeFieldOrdered" })
class ScopeFieldOrdered {
  @PrimaryKeyField()
  id!: string;

  @ScopeField({ order: 2 })
  tenantId!: string;

  @ScopeField({ order: 1 })
  region!: string;

  @ScopeField()
  env!: string;
}

@Entity({ name: "ScopeFieldMultiple" })
class ScopeFieldMultiple {
  @PrimaryKeyField()
  id!: string;

  @ScopeField()
  tenantId!: string;

  @ScopeField()
  region!: string;
}

describe("ScopeField", () => {
  test("should register scope field with correct metadata", () => {
    expect(getEntityMetadata(ScopeFieldDecorated)).toMatchSnapshot();
  });

  test("should register string type scope field", () => {
    const meta = getEntityMetadata(ScopeFieldDecorated);
    const field = meta.fields.find((f) => f.key === "scope");
    expect(field).toBeDefined();
    expect(field!.type).toBe("string");
    expect(field!.decorator).toBe("Scope");
  });

  test("should be readonly with min 1", () => {
    const meta = getEntityMetadata(ScopeFieldDecorated);
    const field = meta.fields.find((f) => f.key === "scope");
    expect(field!.readonly).toBe(true);
    expect(field!.min).toBe(1);
  });

  test("should have order null by default", () => {
    const meta = getEntityMetadata(ScopeFieldDecorated);
    const field = meta.fields.find((f) => f.key === "scope");
    expect(field!.order).toBeNull();
  });
});

describe("ScopeField — order option", () => {
  test("should store explicit order on field metadata", () => {
    const meta = getEntityMetadata(ScopeFieldOrdered);
    const tenantField = meta.fields.find((f) => f.key === "tenantId");
    const regionField = meta.fields.find((f) => f.key === "region");
    const envField = meta.fields.find((f) => f.key === "env");

    expect(tenantField!.order).toBe(2);
    expect(regionField!.order).toBe(1);
    expect(envField!.order).toBeNull();
  });

  test("should produce scopeKeys sorted by order then alphabetically", () => {
    const meta = getEntityMetadata(ScopeFieldOrdered);

    // order=1 (region), order=2 (tenantId), then alphabetical (env)
    expect(meta.scopeKeys).toEqual(["region", "tenantId", "env"]);
  });
});

describe("ScopeField — auto-generated __scope filter", () => {
  test("should auto-register __scope filter for single scope field", () => {
    const meta = getEntityMetadata(ScopeFieldDecorated);
    const scopeFilter = meta.filters.find((f) => f.name === SCOPE_FILTER_NAME);

    expect(scopeFilter).toBeDefined();
    expect(scopeFilter!.condition).toEqual({ scope: "$scope" });
    expect(scopeFilter!.default).toBe(true);
  });

  test("should auto-register __scope filter with $and for multiple scope fields", () => {
    const meta = getEntityMetadata(ScopeFieldMultiple);
    const scopeFilter = meta.filters.find((f) => f.name === SCOPE_FILTER_NAME);

    expect(scopeFilter).toBeDefined();
    // Alphabetical order: region before tenantId
    expect(scopeFilter!.condition).toEqual({
      $and: [{ region: "$region" }, { tenantId: "$tenantId" }],
    });
  });

  test("should produce scopeKeys in alphabetical order for unordered fields", () => {
    const meta = getEntityMetadata(ScopeFieldMultiple);
    expect(meta.scopeKeys).toEqual(["region", "tenantId"]);
  });

  test("should produce empty scopeKeys when no scope fields exist", () => {
    @Entity({ name: "NoScopeEntity" })
    class NoScopeEntity {
      @PrimaryKeyField()
      id!: string;
    }

    const meta = getEntityMetadata(NoScopeEntity);
    expect(meta.scopeKeys).toEqual([]);
  });
});
