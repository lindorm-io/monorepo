import { makeField } from "../../../../__fixtures__/make-field.js";
import type { EntityMetadata, MetaFilter } from "../../../../entity/types/metadata.js";
import { SOFT_DELETE_FILTER_NAME } from "../../../../entity/metadata/auto-filters.js";
import { compileIncrement } from "./compile-increment.js";
import { describe, expect, test } from "vitest";

const metadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "users",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("score", { type: "integer" }),
    makeField("balance", { type: "decimal", name: "account_balance" }),
  ],
  filters: [],
  relations: [],
  primaryKeys: ["id"],
  generated: [],
} as unknown as EntityMetadata;

// Metadata with no namespace — used for namespace override test
const noNamespaceMeta = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "counters",
    namespace: null,
  },
  fields: [makeField("id", { type: "uuid" }), makeField("hits", { type: "integer" })],
  filters: [],
  relations: [],
  primaryKeys: ["id"],
  generated: [],
} as unknown as EntityMetadata;

// Soft-delete metadata — has a DeleteDate field so __softDelete filter auto-generates
const softDeleteFilter: MetaFilter = {
  name: SOFT_DELETE_FILTER_NAME,
  condition: { deletedAt: null },
  default: true,
};

const softDeleteMeta = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "posts",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("views", { type: "integer" }),
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
  generated: [],
} as unknown as EntityMetadata;

describe("compileIncrement", () => {
  test("should compile increment with positive value", () => {
    const result = compileIncrement(
      { id: "abc-123" } as any,
      "score" as any,
      5,
      metadata,
    );
    expect(result).toMatchSnapshot();
  });

  test("should compile decrement with negative value", () => {
    const result = compileIncrement(
      { id: "abc-123" } as any,
      "score" as any,
      -3,
      metadata,
    );
    expect(result).toMatchSnapshot();
  });

  test("should use column name from metadata", () => {
    const result = compileIncrement(
      { id: "abc-123" } as any,
      "balance" as any,
      10,
      metadata,
    );
    expect(result.text).toContain('"account_balance"');
  });

  test("should use table alias in expression", () => {
    const result = compileIncrement(
      { id: "abc-123" } as any,
      "score" as any,
      1,
      metadata,
    );
    expect(result.text).toContain('"t0"."score"');
  });

  describe("namespace override", () => {
    test("uses explicit namespace when metadata.namespace is null", () => {
      const result = compileIncrement(
        { id: "x-1" } as any,
        "hits" as any,
        1,
        noNamespaceMeta,
        "public",
      );
      expect(result).toMatchSnapshot();
      expect(result.text).toContain('"public"."counters"');
    });

    test("metadata.namespace takes precedence over explicit namespace override", () => {
      // metadata.namespace = "app", override = "public" — "app" wins
      const result = compileIncrement(
        { id: "abc-123" } as any,
        "score" as any,
        1,
        metadata,
        "public",
      );
      expect(result.text).toContain('"app"."users"');
      expect(result.text).not.toContain('"public"');
    });

    test("unqualified table name when both metadata.namespace is null and no override", () => {
      const result = compileIncrement(
        { id: "x-1" } as any,
        "hits" as any,
        1,
        noNamespaceMeta,
      );
      expect(result).toMatchSnapshot();
      expect(result.text).toContain('"counters"');
      expect(result.text).not.toContain('"public"');
      expect(result.text).not.toContain('"app"');
    });
  });

  describe("zero value", () => {
    test("value: 0 compiles to + $1 with params[0] = 0", () => {
      // Zero is a valid increment value — must not be falsy-skipped
      const result = compileIncrement(
        { id: "abc-123" } as any,
        "score" as any,
        0,
        metadata,
      );
      expect(result).toMatchSnapshot();
      expect(result.params[0]).toBe(0);
      expect(result.text).toContain("+ $1");
    });
  });

  describe("empty criteria", () => {
    test("produces UPDATE without WHERE clause when criteria is empty {}", () => {
      // No predicates → compileWhereWithFilters emits no user WHERE,
      // but system filters (if any) may still apply.
      // metadata has no DeleteDate field → no soft-delete filter → no WHERE at all.
      const result = compileIncrement({} as any, "score" as any, 5, metadata);
      expect(result).toMatchSnapshot();
      expect(result.text).not.toContain("WHERE");
    });
  });

  describe("system filter applied", () => {
    test("includes soft-delete IS NULL condition when entity has DeleteDate field", () => {
      // softDeleteMeta has a __softDelete filter — compileWhereWithFilters must apply it
      // even though the user criteria only references id
      const result = compileIncrement(
        { id: "post-1" } as any,
        "views" as any,
        1,
        softDeleteMeta,
      );
      expect(result).toMatchSnapshot();
      expect(result.text).toContain('"deleted_at" IS NULL');
    });

    test("soft-delete condition is ANDed after the id criteria", () => {
      const result = compileIncrement(
        { id: "post-1" } as any,
        "views" as any,
        1,
        softDeleteMeta,
      );
      // id criteria ($2) must come before the IS NULL condition (no params)
      expect(result.params).toHaveLength(2); // [value, id]
      expect(result.text).toContain("WHERE");
      expect(result.text).toContain("IS NULL");
    });
  });
});
