import { describe, expect, test } from "vitest";
import { makeField } from "../../../../__fixtures__/make-field";
import type { EntityMetadata, MetaFilter } from "../../../../entity/types/metadata";
import type { SubqueryPredicateSpec } from "../../../../types/query";
import {
  SCOPE_FILTER_NAME,
  SOFT_DELETE_FILTER_NAME,
} from "../../../../entity/metadata/auto-filters";
import { createEmptyState } from "../../../../../classes/QueryBuilder";
import { compileWhereWithFilters, getVersionCondition } from "./compile-system-filters";

// --- Metadata fixtures ---

const metadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "orders",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("status", { type: "string" }),
    makeField("amount", { type: "float" }),
  ],
  filters: [],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

// Build the __softDelete filter the same way auto-filters does
const softDeleteFilter: MetaFilter = {
  name: SOFT_DELETE_FILTER_NAME,
  condition: { deletedAt: null },
  default: true,
};

const softDeleteMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "invoices",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("total", { type: "float" }),
    makeField("deletedAt", {
      type: "timestamp",
      name: "deleted_at",
      decorator: "DeleteDate",
      nullable: true,
    }),
  ],
  filters: [softDeleteFilter],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const versionedMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "prices",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("value", { type: "float" }),
    makeField("versionStartDate", {
      type: "timestamp",
      name: "version_start_date",
      decorator: "VersionStartDate",
    }),
    makeField("versionEndDate", {
      type: "timestamp",
      name: "version_end_date",
      decorator: "VersionEndDate",
      nullable: true,
    }),
  ],
  filters: [],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

// Scoped entity metadata — has __scope filter (default-on, requires params)
const scopeFilter: MetaFilter = {
  name: SCOPE_FILTER_NAME,
  condition: { scope: "$scope" },
  default: true,
};

const scopedMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "tenants",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("scope", { type: "string", name: "scope", decorator: "Scope" }),
    makeField("label", { type: "string" }),
  ],
  filters: [scopeFilter],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

// Entity with both softDelete and scope filters
const softDeleteFilter2: MetaFilter = {
  name: SOFT_DELETE_FILTER_NAME,
  condition: { deletedAt: null },
  default: true,
};

const tenantFilter: MetaFilter = {
  name: "tenant",
  condition: { tenantId: "$tenantId" },
  default: false,
};

const multiFilterMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "widgets",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("tenantId", { type: "string", name: "tenant_id" }),
    makeField("label", { type: "string" }),
    makeField("deletedAt", {
      type: "timestamp",
      name: "deleted_at",
      decorator: "DeleteDate",
      nullable: true,
    }),
  ],
  filters: [softDeleteFilter2, tenantFilter],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

// --- compileWhereWithFilters ---

describe("compileWhereWithFilters", () => {
  describe("basic WHERE combinations", () => {
    // Case 1: empty state, plain metadata — no predicates, no system filters
    test("returns empty string when there are no predicates and no system filters", () => {
      const state = createEmptyState<any>();
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, metadata, params);
      expect(result).toBe("");
      expect(params).toEqual([]);
    });

    // Case 2: user predicates only, no system filters
    test("returns user WHERE clause when there are predicates but no system filters", () => {
      const state = createEmptyState<any>();
      state.predicates = [{ predicate: { status: "active" }, conjunction: "and" }];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, metadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["active"]);
    });

    // Case 3: soft-delete system filter only (no user predicates)
    test("returns WHERE with soft-delete IS NULL condition when entity has DeleteDate field", () => {
      const state = createEmptyState<any>();
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, softDeleteMetadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual([]);
    });

    // Case 4: version system filter only (no user predicates)
    test("returns WHERE with versionEndDate IS NULL condition when entity has version fields", () => {
      const state = createEmptyState<any>();
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, versionedMetadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual([]);
    });

    // Case 5: user predicate + soft-delete filter — ANDed together
    test("ANDs user WHERE clause with soft-delete system condition", () => {
      const state = createEmptyState<any>();
      state.predicates = [{ predicate: { total: { $gte: 100 } }, conjunction: "and" }];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, softDeleteMetadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual([100]);
    });

    // Case 6: user predicate + version filter — ANDed together
    test("ANDs user WHERE clause with version system condition", () => {
      const state = createEmptyState<any>();
      state.predicates = [{ predicate: { value: { $gt: 0 } }, conjunction: "and" }];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, versionedMetadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual([0]);
    });
  });

  describe("withDeleted disables __softDelete filter", () => {
    test("omits soft-delete condition when withDeleted is true", () => {
      const state = createEmptyState<any>();
      state.withDeleted = true;
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, softDeleteMetadata, params);
      expect(result).toBe("");
      expect(params).toEqual([]);
    });

    test("omits soft-delete condition when metadata has no __softDelete filter", () => {
      const state = createEmptyState<any>();
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, metadata, params);
      expect(result).toBe("");
      expect(params).toEqual([]);
    });
  });

  describe("raw WHERE (S1)", () => {
    // Case 7: raw WHERE with "and" conjunction appended
    test("appends raw WHERE with AND conjunction to existing WHERE clause", () => {
      const state = createEmptyState<any>();
      state.predicates = [{ predicate: { status: "active" }, conjunction: "and" }];
      state.rawWhere = [{ sql: "amount > $1", params: [50], conjunction: "and" }];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, metadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["active", 50]);
    });

    // Case 8: raw WHERE with "or" conjunction — wraps existing clause in parens
    test("wraps existing WHERE clause in parens when raw WHERE uses OR conjunction", () => {
      const state = createEmptyState<any>();
      state.predicates = [{ predicate: { status: "active" }, conjunction: "and" }];
      state.rawWhere = [{ sql: "amount > $1", params: [50], conjunction: "or" }];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, metadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["active", 50]);
    });

    // Case 9: multiple raw WHERE entries with mixed conjunctions
    test("handles multiple raw WHERE entries with mixed AND/OR conjunctions", () => {
      const state = createEmptyState<any>();
      state.rawWhere = [
        { sql: "status = $1", params: ["active"], conjunction: "and" },
        { sql: "amount > $1", params: [100], conjunction: "and" },
        { sql: "status = $1", params: ["pending"], conjunction: "or" },
      ];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, metadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["active", 100, "pending"]);
    });

    // Case 10: raw WHERE only (no user predicates, no system filters) — starts with WHERE
    test("emits WHERE keyword when raw WHERE is the only clause (no predicates, no system filters)", () => {
      const state = createEmptyState<any>();
      state.rawWhere = [{ sql: "status = $1", params: ["active"], conjunction: "and" }];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, metadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["active"]);
    });

    // Case 11: raw WHERE with pre-existing params — reindexed correctly
    test("reindexes raw WHERE $N placeholders relative to pre-existing params", () => {
      const state = createEmptyState<any>();
      state.predicates = [{ predicate: { status: "active" }, conjunction: "and" }];
      state.rawWhere = [
        { sql: "amount BETWEEN $1 AND $2", params: [10, 500], conjunction: "and" },
      ];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, metadata, params);
      // status = $1 is consumed first, so BETWEEN becomes $2 AND $3
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["active", 10, 500]);
    });
  });

  describe("subquery predicates (S3)", () => {
    // Case 12: IN subquery predicate
    test("appends IN subquery predicate to WHERE clause", () => {
      const state = createEmptyState<any>();
      const subquery: SubqueryPredicateSpec = {
        type: "in",
        field: "id",
        sql: "SELECT id FROM archived WHERE year = $1",
        params: [2023],
        conjunction: "and",
      };
      state.subqueryPredicates = [subquery];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, metadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual([2023]);
    });

    // Case 13: NOT IN subquery predicate
    test("appends NOT IN subquery predicate to WHERE clause", () => {
      const state = createEmptyState<any>();
      const subquery: SubqueryPredicateSpec = {
        type: "nin",
        field: "id",
        sql: "SELECT id FROM blacklist",
        params: [],
        conjunction: "and",
      };
      state.subqueryPredicates = [subquery];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, metadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual([]);
    });

    // Case 14: EXISTS subquery predicate
    test("appends EXISTS subquery predicate to WHERE clause", () => {
      const state = createEmptyState<any>();
      const subquery: SubqueryPredicateSpec = {
        type: "exists",
        sql: "SELECT 1 FROM payments WHERE payments.order_id = t0.id AND payments.amount > $1",
        params: [0],
        conjunction: "and",
      };
      state.subqueryPredicates = [subquery];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, metadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual([0]);
    });

    // Case 15: NOT EXISTS subquery predicate
    test("appends NOT EXISTS subquery predicate to WHERE clause", () => {
      const state = createEmptyState<any>();
      const subquery: SubqueryPredicateSpec = {
        type: "notExists",
        sql: "SELECT 1 FROM refunds WHERE refunds.order_id = t0.id",
        params: [],
        conjunction: "and",
      };
      state.subqueryPredicates = [subquery];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, metadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual([]);
    });

    // Case 16: subquery with "or" conjunction — wraps existing clause in parens
    test("wraps existing WHERE clause in parens when subquery predicate uses OR conjunction", () => {
      const state = createEmptyState<any>();
      state.predicates = [{ predicate: { status: "active" }, conjunction: "and" }];
      const subquery: SubqueryPredicateSpec = {
        type: "exists",
        sql: "SELECT 1 FROM vip WHERE vip.order_id = t0.id",
        params: [],
        conjunction: "or",
      };
      state.subqueryPredicates = [subquery];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, metadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["active"]);
    });

    // Case 17: multiple subquery predicates
    test("appends multiple subquery predicates in sequence", () => {
      const state = createEmptyState<any>();
      state.predicates = [{ predicate: { status: "active" }, conjunction: "and" }];
      state.subqueryPredicates = [
        {
          type: "in",
          field: "id",
          sql: "SELECT id FROM high_value WHERE amount > $1",
          params: [1000],
          conjunction: "and",
        },
        {
          type: "notExists",
          sql: "SELECT 1 FROM flags WHERE flags.order_id = t0.id",
          params: [],
          conjunction: "and",
        },
      ];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, metadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["active", 1000]);
    });
  });

  describe("user-defined @Filter predicates (S7)", () => {
    // Case: resolved filter only — no user predicates, no system filters
    test("emits WHERE clause from a single resolved filter predicate", () => {
      const state = createEmptyState<any>();
      state.resolvedFilters = [{ name: "active", predicate: { status: "active" } }];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, metadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["active"]);
    });

    // Case: resolved filter + system soft-delete — both ANDed
    test("ANDs resolved filter with system soft-delete condition", () => {
      const state = createEmptyState<any>();
      state.resolvedFilters = [
        { name: "highTotal", predicate: { total: { $gte: 1000 } } },
      ];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, softDeleteMetadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual([1000]);
    });

    // Case: user predicate + system filter + resolved filter — all ANDed
    test("ANDs user predicate, system filter, and resolved filter together", () => {
      const state = createEmptyState<any>();
      state.predicates = [{ predicate: { total: { $lt: 9999 } }, conjunction: "and" }];
      state.resolvedFilters = [{ name: "bigTotal", predicate: { total: { $gt: 500 } } }];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, softDeleteMetadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual([9999, 500]);
    });

    // Case: multiple resolved filters — all ANDed in sequence
    test("ANDs multiple resolved filters in sequence", () => {
      const state = createEmptyState<any>();
      state.resolvedFilters = [
        { name: "active", predicate: { status: "active" } },
        { name: "bigAmount", predicate: { amount: { $gte: 100 } } },
      ];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, metadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["active", 100]);
    });

    // Case: resolved filter with $or predicate
    test("compiles resolved filter containing $or predicate", () => {
      const state = createEmptyState<any>();
      state.resolvedFilters = [
        {
          name: "visible",
          predicate: { $or: [{ status: "published" }, { status: "featured" }] },
        },
      ];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, metadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["published", "featured"]);
    });

    // Case: resolved filter appears BEFORE raw WHERE in output order
    test("applies resolved filters before raw WHERE fragments", () => {
      const state = createEmptyState<any>();
      state.resolvedFilters = [{ name: "active", predicate: { status: "active" } }];
      state.rawWhere = [{ sql: "amount > $1", params: [50], conjunction: "and" }];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, metadata, params);
      expect(result).toMatchSnapshot();
      expect(params).toEqual(["active", 50]);
    });
  });

  describe("C3 fix — OR does not bypass system filters", () => {
    // Case 18: Raw WHERE with OR conjunction on soft-delete entity
    // The soft-delete condition must be inside parens so OR cannot bypass it.
    // e.g. WHERE ("t0"."deleted_at" IS NULL) OR raw_fragment
    // NOT   WHERE "t0"."deleted_at" IS NULL OR raw_fragment
    test("preserves soft-delete condition inside parens when raw WHERE uses OR conjunction", () => {
      const state = createEmptyState<any>();
      // No user predicates — only the system soft-delete filter applies
      state.rawWhere = [{ sql: "total > $1", params: [999], conjunction: "or" }];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, softDeleteMetadata, params);
      // Expected shape: WHERE ("t0"."deleted_at" IS NULL) OR total > $1
      expect(result).toMatchSnapshot();
      expect(params).toEqual([999]);
      // The result must contain parens around the soft-delete clause
      expect(result).toContain("(");
      // AND the OR must appear AFTER the closing paren
      const parenCloseIdx = result.lastIndexOf(")");
      const orIdx = result.lastIndexOf(" OR ");
      expect(orIdx).toBeGreaterThan(parenCloseIdx);
    });
  });

  // ─── FIX-7: withoutScope disables __scope filter ───────────────────────────

  describe("withoutScope disables __scope filter (FIX-7)", () => {
    test("withoutScope: false — scope filter with params IS applied", () => {
      const state = createEmptyState<any>();
      // Simulate scope params being registered on QB via setFilter
      state.filterOverrides = {
        [SCOPE_FILTER_NAME]: { scope: "tenant-a" },
      };
      state.withoutScope = false;
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, scopedMetadata, params);
      // Scope filter with params is active — WHERE should include scope condition
      expect(result).toMatchSnapshot();
      expect(params).toContain("tenant-a");
    });

    test("withoutScope: true — __scope filter is suppressed even when params are present", () => {
      const state = createEmptyState<any>();
      // Scope params are set on QB but withoutScope overrides
      state.filterOverrides = {
        [SCOPE_FILTER_NAME]: { scope: "tenant-a" },
      };
      state.withoutScope = true;
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, scopedMetadata, params);
      // withoutScope disables the __scope filter — WHERE should be empty (no other predicates)
      expect(result).toBe("");
      expect(params).toEqual([]);
    });

    test("withoutScope: true does not suppress non-scope filters like __softDelete", () => {
      const state = createEmptyState<any>();
      state.withoutScope = true;
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, softDeleteMetadata, params);
      // soft-delete filter must still apply — withoutScope only targets __scope
      expect(result).toMatchSnapshot();
      expect(result).toContain("IS NULL");
    });
  });

  // ─── FIX-5: filterOverrides via QB .setFilter() ───────────────────────────

  describe("filterOverrides (QB .setFilter() wiring, FIX-5)", () => {
    test("filterOverrides with false disables a filter by name", () => {
      const state = createEmptyState<any>();
      // Explicitly disable __softDelete via setFilter("__softDelete", false)
      state.filterOverrides = { [SOFT_DELETE_FILTER_NAME]: false };
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, softDeleteMetadata, params);
      // __softDelete disabled → no IS NULL condition in WHERE
      expect(result).toBe("");
      expect(params).toEqual([]);
    });

    test("filterOverrides with true explicitly re-enables a filter", () => {
      const state = createEmptyState<any>();
      // Re-enable __softDelete explicitly (it's default-on but this tests the override path)
      state.filterOverrides = { [SOFT_DELETE_FILTER_NAME]: true };
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, softDeleteMetadata, params);
      // __softDelete explicitly enabled → IS NULL condition present
      expect(result).toMatchSnapshot();
      expect(result).toContain("IS NULL");
    });

    test("filterOverrides with Dict enables a named filter with specific params", () => {
      const state = createEmptyState<any>();
      state.filterOverrides = { tenant: { tenantId: "org-42" } };
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, multiFilterMetadata, params);
      // tenant filter with tenantId param should produce WHERE clause with param
      expect(result).toMatchSnapshot();
      expect(params).toContain("org-42");
    });

    test("filterOverrides false for softDelete + user predicate — only predicate remains", () => {
      const state = createEmptyState<any>();
      // Use "total" which exists in softDeleteMetadata
      state.predicates = [{ predicate: { total: { $gte: 50 } }, conjunction: "and" }];
      state.filterOverrides = { [SOFT_DELETE_FILTER_NAME]: false };
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, softDeleteMetadata, params);
      // Only user predicate, no soft-delete condition
      expect(result).toMatchSnapshot();
      expect(params).toEqual([50]);
      expect(result).not.toContain("IS NULL");
    });

    test("multiple filterOverrides accumulate — disable softDelete, enable tenant", () => {
      const state = createEmptyState<any>();
      state.filterOverrides = {
        [SOFT_DELETE_FILTER_NAME]: false,
        tenant: { tenantId: "t-99" },
      };
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, multiFilterMetadata, params);
      // softDelete disabled, tenant enabled with param
      expect(result).toMatchSnapshot();
      expect(result).not.toContain("IS NULL");
      expect(params).toContain("t-99");
    });
  });

  describe("duplicate filter deduplication", () => {
    // collectEffectiveFilters deduplicates by name: system filters from metadata
    // are only applied if their name is NOT already in state.resolvedFilters.
    // These tests verify that the same filter cannot be applied twice.

    test("__softDelete filter is not double-applied when already in state.resolvedFilters", () => {
      // The repo path pre-resolves __softDelete and puts it in state.resolvedFilters.
      // collectEffectiveFilters must NOT add the system __softDelete again.
      const state = createEmptyState<any>();
      state.resolvedFilters = [
        { name: SOFT_DELETE_FILTER_NAME, predicate: { deletedAt: null } },
      ];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, softDeleteMetadata, params);
      expect(result).toMatchSnapshot();
      // IS NULL must appear exactly once, not twice
      const isNullMatches = result.match(/IS NULL/g) ?? [];
      expect(isNullMatches).toHaveLength(1);
    });

    test("user-defined filter in resolvedFilters is not re-applied from QB filterOverrides", () => {
      // If a non-system filter is in state.resolvedFilters AND also in filterOverrides,
      // it should only appear once in the WHERE clause.
      const state = createEmptyState<any>();
      state.resolvedFilters = [{ name: "tenant", predicate: { tenantId: "org-1" } }];
      // Also set filterOverrides with the same filter name
      state.filterOverrides = {
        tenant: { tenantId: "org-1" },
      };
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, multiFilterMetadata, params);
      expect(result).toMatchSnapshot();
      // "org-1" must appear only once as a param
      const orgMatches = params.filter((p) => p === "org-1");
      expect(orgMatches).toHaveLength(1);
    });

    test("__softDelete in resolvedFilters deduplicates even when withDeleted is false", () => {
      // withDeleted: false means the system path would normally emit __softDelete.
      // But since it's already in resolvedFilters, collectEffectiveFilters skips it.
      const state = createEmptyState<any>();
      state.withDeleted = false;
      state.resolvedFilters = [
        { name: SOFT_DELETE_FILTER_NAME, predicate: { deletedAt: null } },
      ];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, softDeleteMetadata, params);
      expect(result).toMatchSnapshot();
      const isNullMatches = result.match(/IS NULL/g) ?? [];
      // Only one IS NULL — from resolvedFilters, not doubled by system path
      expect(isNullMatches).toHaveLength(1);
    });

    test("two distinct filters both appear when both are in resolvedFilters", () => {
      // Sanity check: dedup only collapses same-name filters, not distinct ones
      const state = createEmptyState<any>();
      state.resolvedFilters = [
        { name: SOFT_DELETE_FILTER_NAME, predicate: { deletedAt: null } },
        { name: "highTotal", predicate: { total: { $gte: 500 } } },
      ];
      const params: Array<unknown> = [];
      const result = compileWhereWithFilters(state, softDeleteMetadata, params);
      expect(result).toMatchSnapshot();
      // Both conditions should appear
      expect(result).toContain("IS NULL");
      expect(result).toContain(">= $");
    });
  });
});

// --- getVersionCondition ---

describe("getVersionCondition", () => {
  // Case 22: withAllVersions = true → returns empty string
  test("returns empty string when withAllVersions is true", () => {
    const state = createEmptyState<any>();
    state.withAllVersions = true;
    const params: Array<unknown> = [];
    const result = getVersionCondition(state, versionedMetadata, params, "t0");
    expect(result).toBe("");
    expect(params).toEqual([]);
  });

  // Case 23: no version fields → returns empty string
  test("returns empty string when metadata has no VersionStartDate or VersionEndDate fields", () => {
    const state = createEmptyState<any>();
    const params: Array<unknown> = [];
    const result = getVersionCondition(state, metadata, params, "t0");
    expect(result).toBe("");
    expect(params).toEqual([]);
  });

  // Case 23b: only one of the two version fields (half-configured entity) → returns empty string
  test("returns empty string when only VersionStartDate is present but VersionEndDate is missing", () => {
    const halfVersionedMetadata = {
      entity: {
        decorator: "Entity",
        cache: null,
        comment: null,
        database: null,
        name: "half",
        namespace: "app",
      },
      fields: [
        makeField("id", { type: "uuid" }),
        makeField("versionStartDate", {
          type: "timestamp",
          name: "version_start_date",
          decorator: "VersionStartDate",
        }),
      ],
      filters: [],
      relations: [],
      primaryKeys: ["id"],
    } as unknown as EntityMetadata;
    const state = createEmptyState<any>();
    const params: Array<unknown> = [];
    const result = getVersionCondition(state, halfVersionedMetadata, params, "t0");
    expect(result).toBe("");
    expect(params).toEqual([]);
  });

  // Case 24: no versionTimestamp → default current-version filter (endDate IS NULL)
  test("returns versionEndDate IS NULL when no versionTimestamp is set", () => {
    const state = createEmptyState<any>();
    const params: Array<unknown> = [];
    const result = getVersionCondition(state, versionedMetadata, params, "t0");
    expect(result).toMatchSnapshot();
    expect(params).toEqual([]);
  });

  // Case 25: versionTimestamp set → point-in-time half-open interval condition
  test("returns half-open interval condition when versionTimestamp is set", () => {
    const state = createEmptyState<any>();
    state.versionTimestamp = new Date("2024-06-15T12:00:00Z");
    const params: Array<unknown> = [];
    const result = getVersionCondition(state, versionedMetadata, params, "t0");
    // Should push the timestamp into params and use $N placeholder
    expect(result).toMatchSnapshot();
    expect(params).toEqual([state.versionTimestamp]);
    // Verify $1 appears twice in the condition (once for >= start, once for > end)
    const matches = result.match(/\$1/g);
    expect(matches).toHaveLength(2);
  });

  // Case 25b: versionTimestamp with pre-existing params — $N correctly offset
  test("reindexes versionTimestamp param when shared params array already has values", () => {
    const state = createEmptyState<any>();
    state.versionTimestamp = new Date("2024-06-15T12:00:00Z");
    const params: Array<unknown> = ["pre-existing"];
    const result = getVersionCondition(state, versionedMetadata, params, "t0");
    // Timestamp pushed as $2 (offset by 1 pre-existing param)
    expect(result).toMatchSnapshot();
    expect(params).toEqual(["pre-existing", state.versionTimestamp]);
    // The condition must reference $2 (not $1)
    expect(result).toContain("$2");
    expect(result).not.toContain("$1");
  });
});
