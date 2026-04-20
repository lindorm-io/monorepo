import type { MetaFilter } from "../../entity/types/metadata";
import type { FilterRegistry } from "./filter-registry";
import { resolveFilters } from "./resolve-filters";
import { describe, expect, test } from "vitest";

const activeFilter: MetaFilter = {
  name: "active",
  condition: { status: "active" },
  default: true,
};

const tenantFilter: MetaFilter = {
  name: "tenant",
  condition: { tenantId: "$tenantId" },
  default: false,
};

const rangeFilter: MetaFilter = {
  name: "highValue",
  condition: { amount: { $gte: "$minAmount" } },
  default: false,
};

describe("resolveFilters", () => {
  describe("default behavior (no registry, no overrides)", () => {
    test("should enable default-on filters", () => {
      const result = resolveFilters([activeFilter], new Map(), undefined);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("active");
      expect(result[0].predicate).toEqual({ status: "active" });
    });

    test("should skip default-off filters", () => {
      const result = resolveFilters([tenantFilter], new Map(), undefined);
      expect(result).toHaveLength(0);
    });

    test("should return empty for empty filters", () => {
      const result = resolveFilters([], new Map(), undefined);
      expect(result).toHaveLength(0);
    });

    test("should return empty for undefined filters", () => {
      const result = resolveFilters(undefined as any, new Map(), undefined);
      expect(result).toHaveLength(0);
    });
  });

  describe("source registry", () => {
    test("should enable a filter via registry", () => {
      const registry: FilterRegistry = new Map([
        ["tenant", { enabled: true, params: { tenantId: "t-123" } }],
      ]);
      const result = resolveFilters([tenantFilter], registry, undefined);
      expect(result).toHaveLength(1);
      expect(result[0].predicate).toEqual({ tenantId: "t-123" });
    });

    test("should disable a default-on filter via registry", () => {
      const registry: FilterRegistry = new Map([
        ["active", { enabled: false, params: {} }],
      ]);
      const result = resolveFilters([activeFilter], registry, undefined);
      expect(result).toHaveLength(0);
    });

    test("should substitute nested operator params", () => {
      const registry: FilterRegistry = new Map([
        ["highValue", { enabled: true, params: { minAmount: 5000 } }],
      ]);
      const result = resolveFilters([rangeFilter], registry, undefined);
      expect(result).toHaveLength(1);
      expect(result[0].predicate).toEqual({ amount: { $gte: 5000 } });
    });
  });

  describe("per-request overrides", () => {
    test("should enable a filter via true override", () => {
      const registry: FilterRegistry = new Map([
        ["tenant", { enabled: false, params: { tenantId: "t-123" } }],
      ]);
      const result = resolveFilters([tenantFilter], registry, { tenant: true });
      expect(result).toHaveLength(1);
      expect(result[0].predicate).toEqual({ tenantId: "t-123" });
    });

    test("should disable a filter via false override", () => {
      const result = resolveFilters([activeFilter], new Map(), { active: false });
      expect(result).toHaveLength(0);
    });

    test("should enable with dict override (provides params)", () => {
      const result = resolveFilters([tenantFilter], new Map(), {
        tenant: { tenantId: "override-tenant" },
      });
      expect(result).toHaveLength(1);
      expect(result[0].predicate).toEqual({ tenantId: "override-tenant" });
    });

    test("dict override should replace registry params", () => {
      const registry: FilterRegistry = new Map([
        ["tenant", { enabled: true, params: { tenantId: "registry-tenant" } }],
      ]);
      const result = resolveFilters([tenantFilter], registry, {
        tenant: { tenantId: "override-tenant" },
      });
      expect(result).toHaveLength(1);
      expect(result[0].predicate).toEqual({ tenantId: "override-tenant" });
    });
  });

  describe("param substitution", () => {
    test("should throw when required param is missing", () => {
      const registry: FilterRegistry = new Map([
        ["tenant", { enabled: true, params: {} }],
      ]);
      expect(() => resolveFilters([tenantFilter], registry, undefined)).toThrow(
        'Filter "tenant" requires parameter "tenantId"',
      );
    });

    test("should not substitute non-param values (no $ prefix)", () => {
      const filter: MetaFilter = {
        name: "literal",
        condition: { status: "active" },
        default: true,
      };
      const result = resolveFilters([filter], new Map(), undefined);
      expect(result[0].predicate).toEqual({ status: "active" });
    });

    test("should substitute params in $and arrays", () => {
      const filter: MetaFilter = {
        name: "complex",
        condition: { $and: [{ tenantId: "$tenantId" }, { status: "active" }] },
        default: false,
      };
      const result = resolveFilters([filter], new Map(), {
        complex: { tenantId: "t-456" },
      });
      expect(result[0].predicate).toEqual({
        $and: [{ tenantId: "t-456" }, { status: "active" }],
      });
    });

    test("should handle null values in condition", () => {
      const filter: MetaFilter = {
        name: "notDeleted",
        condition: { deletedAt: null },
        default: true,
      };
      const result = resolveFilters([filter], new Map(), undefined);
      expect(result[0].predicate).toEqual({ deletedAt: null });
    });
  });

  describe("param-dependent default behavior", () => {
    test("should silently skip default-on filter with $params when no params are available", () => {
      // This simulates __scope: default=true, condition has $params, no registry or override
      const scopeFilter: MetaFilter = {
        name: "__scope",
        condition: { tenantId: "$tenantId" },
        default: true,
      };

      const result = resolveFilters([scopeFilter], new Map(), undefined);
      expect(result).toHaveLength(0);
    });

    test("should activate default-on filter with $params when registry provides params", () => {
      const scopeFilter: MetaFilter = {
        name: "__scope",
        condition: { tenantId: "$tenantId" },
        default: true,
      };

      const registry: FilterRegistry = new Map([
        ["__scope", { enabled: true, params: { tenantId: "t-abc" } }],
      ]);

      const result = resolveFilters([scopeFilter], registry, undefined);
      expect(result).toHaveLength(1);
      expect(result[0].predicate).toEqual({ tenantId: "t-abc" });
    });

    test("should activate default-on filter with $params when override provides params", () => {
      const scopeFilter: MetaFilter = {
        name: "__scope",
        condition: { tenantId: "$tenantId" },
        default: true,
      };

      const result = resolveFilters([scopeFilter], new Map(), {
        __scope: { tenantId: "t-xyz" },
      });
      expect(result).toHaveLength(1);
      expect(result[0].predicate).toEqual({ tenantId: "t-xyz" });
    });

    test("should still throw when registry enables filter but params are incomplete", () => {
      const scopeFilter: MetaFilter = {
        name: "__scope",
        condition: { tenantId: "$tenantId" },
        default: true,
      };

      const registry: FilterRegistry = new Map([
        ["__scope", { enabled: true, params: {} }],
      ]);

      expect(() => resolveFilters([scopeFilter], registry, undefined)).toThrow(
        'Filter "__scope" requires parameter "tenantId"',
      );
    });

    test("should still throw when override: true but no params registered", () => {
      const scopeFilter: MetaFilter = {
        name: "__scope",
        condition: { tenantId: "$tenantId" },
        default: true,
      };

      expect(() => resolveFilters([scopeFilter], new Map(), { __scope: true })).toThrow(
        'Filter "__scope" requires parameter "tenantId"',
      );
    });

    test("should not skip default-on filter when condition has no $params", () => {
      // __softDelete has no $params — should always activate
      const softDeleteFilter: MetaFilter = {
        name: "__softDelete",
        condition: { deletedAt: null },
        default: true,
      };

      const result = resolveFilters([softDeleteFilter], new Map(), undefined);
      expect(result).toHaveLength(1);
      expect(result[0].predicate).toEqual({ deletedAt: null });
    });

    test("should handle $and conditions with $params in default-skip logic", () => {
      const multiScopeFilter: MetaFilter = {
        name: "__scope",
        condition: { $and: [{ tenantId: "$tenantId" }, { region: "$region" }] },
        default: true,
      };

      // No registry, no override — should skip
      const result = resolveFilters([multiScopeFilter], new Map(), undefined);
      expect(result).toHaveLength(0);
    });
  });

  describe("multiple filters", () => {
    test("should resolve multiple filters independently", () => {
      const registry: FilterRegistry = new Map([
        ["tenant", { enabled: true, params: { tenantId: "t-789" } }],
      ]);
      const result = resolveFilters(
        [activeFilter, tenantFilter, rangeFilter],
        registry,
        undefined,
      );
      // active = default:true (enabled), tenant = registry enabled, highValue = default:false (disabled)
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("active");
      expect(result[1].name).toBe("tenant");
    });
  });
});
