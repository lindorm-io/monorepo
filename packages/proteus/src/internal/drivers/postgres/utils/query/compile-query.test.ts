import { makeField } from "../../../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { QueryState } from "../../../../types/query.js";
import { compileCount, compileQuery } from "./compile-query.js";
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
    makeField("name", { type: "string" }),
    makeField("email", { type: "string", name: "email_address" }),
    makeField("age", { type: "integer" }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const createEmptyState = (): QueryState<any> => ({
  predicates: [],
  orderBy: null,
  skip: null,
  take: null,
  includes: [],
  selections: null,
  withDeleted: false,
  distinct: false,
  lock: null,
  versionTimestamp: null,
  withAllVersions: false,
  rawSelections: [],
  rawWhere: [],
  groupBy: null,
  having: [],
  rawHaving: [],
  subqueryPredicates: [],
  ctes: [],
  cteFrom: null,
  windows: [],
  setOperations: [],
  resolvedFilters: [],
  withoutScope: false,
  filterOverrides: {},
});

describe("compileQuery", () => {
  test("should compile basic select all", () => {
    const state = createEmptyState();
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
  });

  test("should compile with where clause", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      predicates: [{ predicate: { name: "Alice" }, conjunction: "and" as const }],
    };
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
  });

  test("should compile with order by", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      orderBy: { name: "ASC", age: "DESC" },
    };
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
  });

  test("should compile with limit and offset", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      skip: 10,
      take: 25,
    };
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
  });

  test("should compile with selections", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      selections: ["id", "name"],
    };
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
  });

  test("should compile with distinct", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      distinct: true,
    };
    const result = compileQuery(state, metadata);
    expect(result.text).toContain("DISTINCT");
  });

  test("should compile full query with all clauses", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      predicates: [
        { predicate: { name: { $like: "%alice%" } }, conjunction: "and" as const },
        { predicate: { age: { $gte: 18 } }, conjunction: "and" as const },
      ],
      orderBy: { name: "ASC" },
      skip: 20,
      take: 10,
      selections: ["id", "name", "age"],
    };
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
  });

  test("should have correct param indices", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      predicates: [
        {
          predicate: { name: "Alice", age: { $between: [18, 65] } },
          conjunction: "and" as const,
        },
      ],
      take: 10,
      skip: 0,
    };
    const result = compileQuery(state, metadata);
    // name=$1, between_low=$2, between_high=$3, limit=$4, offset=$5
    expect(result.params).toEqual(["Alice", 18, 65, 10, 0]);
    expect(result.text).toContain("$1");
    expect(result.text).toContain("$2");
    expect(result.text).toContain("$3");
    expect(result.text).toContain("$4");
    expect(result.text).toContain("$5");
  });
});

// --- Versioned metadata fixture ---

const versionedMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "documents",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("title", { type: "string" }),
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
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const softDeleteMetadata = {
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
    makeField("title", { type: "string" }),
    makeField("deletedAt", {
      type: "timestamp",
      name: "deleted_at",
      decorator: "DeleteDate",
      nullable: true,
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const versionedAndSoftDeleteMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "articles",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("title", { type: "string" }),
    makeField("deletedAt", {
      type: "timestamp",
      name: "deleted_at",
      decorator: "DeleteDate",
      nullable: true,
    }),
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
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const halfVersionedMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "broken",
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
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

describe("version filtering", () => {
  test("should not emit version condition on non-versioned entity", () => {
    const state = createEmptyState();
    const result = compileQuery(state, metadata);
    expect(result.text).not.toContain("WHERE");
    expect(result.params).toEqual([]);
  });

  test("should not emit version condition on non-versioned entity even with versionTimestamp", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      versionTimestamp: new Date("2025-06-15T00:00:00Z"),
    };
    const result = compileQuery(state, metadata);
    expect(result.text).not.toContain("WHERE");
    expect(result.params).toEqual([]);
  });

  test("should emit VersionEndDate IS NULL by default on versioned entity", () => {
    const state = createEmptyState();
    const result = compileQuery(state, versionedMetadata);
    expect(result).toMatchSnapshot();
  });

  test("should emit parameterized range condition with versionTimestamp", () => {
    const timestamp = new Date("2025-06-15T12:00:00Z");
    const state: QueryState<any> = {
      ...createEmptyState(),
      versionTimestamp: timestamp,
    };
    const result = compileQuery(state, versionedMetadata);
    expect(result).toMatchSnapshot();
    expect(result.params).toContain(timestamp);
  });

  test("should not emit version condition when withAllVersions is true", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      withAllVersions: true,
    };
    const result = compileQuery(state, versionedMetadata);
    expect(result.text).not.toContain("WHERE");
    expect(result.params).toEqual([]);
  });

  test("should skip version filtering when withAllVersions is true even if versionTimestamp is set", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      withAllVersions: true,
      versionTimestamp: new Date("2025-06-15T00:00:00Z"),
    };
    const result = compileQuery(state, versionedMetadata);
    expect(result.text).not.toContain("WHERE");
    expect(result.params).toEqual([]);
  });

  test("should not emit version condition when only one version decorator is present", () => {
    const state = createEmptyState();
    const result = compileQuery(state, halfVersionedMetadata);
    expect(result.text).not.toContain("WHERE");
    expect(result.params).toEqual([]);
  });
});

describe("soft-delete filtering", () => {
  test("should emit DeleteDate IS NULL by default on soft-deletable entity", () => {
    const state = createEmptyState();
    const result = compileQuery(state, softDeleteMetadata);
    expect(result).toMatchSnapshot();
  });

  test("should skip soft-delete condition when withDeleted is true", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      withDeleted: true,
    };
    const result = compileQuery(state, softDeleteMetadata);
    expect(result.text).not.toContain("WHERE");
  });
});

describe("combined soft-delete + version filtering", () => {
  test("should AND both conditions on versioned + soft-deletable entity", () => {
    const state = createEmptyState();
    const result = compileQuery(state, versionedAndSoftDeleteMetadata);
    expect(result).toMatchSnapshot();
  });

  test("should emit only version condition when withDeleted is true", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      withDeleted: true,
    };
    const result = compileQuery(state, versionedAndSoftDeleteMetadata);
    expect(result).toMatchSnapshot();
  });

  test("should AND user WHERE with both system conditions", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      predicates: [{ predicate: { title: "test" }, conjunction: "and" as const }],
    };
    const result = compileQuery(state, versionedAndSoftDeleteMetadata);
    expect(result).toMatchSnapshot();
  });

  test("should emit point-in-time version + soft-delete with correct param indices", () => {
    const timestamp = new Date("2025-06-15T12:00:00Z");
    const state: QueryState<any> = {
      ...createEmptyState(),
      predicates: [{ predicate: { title: "test" }, conjunction: "and" as const }],
      versionTimestamp: timestamp,
      take: 10,
    };
    const result = compileQuery(state, versionedAndSoftDeleteMetadata);
    expect(result).toMatchSnapshot();
    // title=$1, versionTimestamp=$2, limit=$3
    expect(result.params).toEqual(["test", timestamp, 10]);
  });
});

describe("compileCount with version filtering", () => {
  test("should apply version filtering to count query", () => {
    const state = createEmptyState();
    const result = compileCount(state, versionedMetadata);
    expect(result).toMatchSnapshot();
  });

  test("should apply point-in-time version filtering to count query", () => {
    const timestamp = new Date("2025-06-15T12:00:00Z");
    const state: QueryState<any> = {
      ...createEmptyState(),
      versionTimestamp: timestamp,
    };
    const result = compileCount(state, versionedMetadata);
    expect(result).toMatchSnapshot();
    expect(result.params).toContain(timestamp);
  });
});

describe("compileCount", () => {
  test("should compile count query", () => {
    const state = createEmptyState();
    const result = compileCount(state, metadata);
    expect(result).toMatchSnapshot();
  });

  test("should compile count with where clause", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      predicates: [{ predicate: { age: { $gte: 18 } }, conjunction: "and" as const }],
    };
    const result = compileCount(state, metadata);
    expect(result).toMatchSnapshot();
  });
});

// --- Phase 12: CTE integration ---

describe("compileQuery — CTE", () => {
  test("should compile WITH clause before SELECT", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      ctes: [
        {
          name: "recent_users",
          sql: 'SELECT * FROM "app"."users" WHERE "age" > $1',
          params: [18],
          materialized: null,
        },
      ],
    };
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toMatch(/^WITH/);
    expect(result.params[0]).toBe(18);
  });

  test("should compile cteFrom — SELECT FROM CTE", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      ctes: [
        {
          name: "filtered",
          sql: 'SELECT "id", "name" FROM "app"."users" WHERE "age" > $1',
          params: [21],
          materialized: null,
        },
      ],
      cteFrom: "filtered",
    };
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain('FROM "filtered" AS "t0"');
  });

  test("should compile CTE with MATERIALIZED hint", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      ctes: [{ name: "mat_cte", sql: "SELECT 1", params: [], materialized: true }],
    };
    const result = compileQuery(state, metadata);
    expect(result.text).toContain("MATERIALIZED");
    expect(result).toMatchSnapshot();
  });

  test("should compile multiple CTEs with correct param ordering", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      ctes: [
        { name: "cte_a", sql: "SELECT $1", params: ["a"], materialized: null },
        { name: "cte_b", sql: "SELECT $1", params: ["b"], materialized: null },
      ],
      predicates: [{ predicate: { name: "Alice" }, conjunction: "and" as const }],
    };
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
    // CTE params first, then query params
    expect(result.params).toEqual(["a", "b", "Alice"]);
  });
});

// --- Phase 12: GROUP BY + HAVING integration ---

describe("compileQuery — GROUP BY + HAVING", () => {
  test("should compile GROUP BY", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      groupBy: ["name"],
    };
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("GROUP BY");
  });

  test("should compile GROUP BY + HAVING with raw expression", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      groupBy: ["name"],
      rawHaving: [{ sql: "COUNT(*) > $1", params: [5], conjunction: "and" as const }],
    };
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("HAVING");
    expect(result.params).toContain(5);
  });
});

// --- Phase 12: compileCount with GROUP BY ---

describe("compileCount — GROUP BY subquery wrap", () => {
  test("should wrap in subquery when GROUP BY is present", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      groupBy: ["name"],
    };
    const result = compileCount(state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("count_sub");
    expect(result.text).toContain('COUNT(*) AS "count"');
  });
});

// --- Phase 12: Set operations integration ---

describe("compileQuery — set operations", () => {
  test("should compile UNION query", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      setOperations: [
        {
          operation: "UNION" as const,
          sql: 'SELECT "t0"."id" AS "t0_id", "t0"."name" AS "t0_name", "t0"."email_address" AS "t0_email", "t0"."age" AS "t0_age" FROM "app"."users" AS "t0" WHERE "t0"."age" > $1',
          params: [30],
        },
      ],
      predicates: [{ predicate: { name: "Alice" }, conjunction: "and" as const }],
    };
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("UNION");
  });

  test("should not allow lock with set operations", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      lock: "pessimistic_write",
      setOperations: [{ operation: "UNION" as const, sql: "SELECT 1", params: [] }],
    };
    expect(() => compileQuery(state, metadata)).toThrow(
      "FOR UPDATE/SHARE is not allowed",
    );
  });
});

// --- Phase 12: compileCount with set operations ---

describe("compileCount — set operations subquery wrap", () => {
  test("should wrap in subquery when set operations are present", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      setOperations: [
        {
          operation: "UNION ALL" as const,
          sql: 'SELECT "t0"."id" AS "t0_id" FROM "app"."users" AS "t0"',
          params: [],
        },
      ],
    };
    const result = compileCount(state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("count_sub");
  });
});

// --- Phase 12: Window functions integration ---

describe("compileQuery — window functions", () => {
  test("should include window functions in SELECT", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      windows: [
        { fn: "ROW_NUMBER" as const, orderBy: { name: "ASC" as const }, alias: "rn" },
      ],
    };
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("ROW_NUMBER()");
    expect(result.text).toContain("OVER");
  });
});

// --- Phase 12: Raw WHERE integration ---

describe("compileQuery — raw WHERE", () => {
  test("should include raw WHERE conditions alongside system filters", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      predicates: [{ predicate: { name: "Alice" }, conjunction: "and" as const }],
      rawWhere: [{ sql: '"age" > $1', params: [21], conjunction: "and" as const }],
    };
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.params).toEqual(["Alice", 21]);
  });

  test("should wrap in parens when raw WHERE uses OR conjunction", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      predicates: [{ predicate: { name: "Alice" }, conjunction: "and" as const }],
      rawWhere: [{ sql: '"age" < $1', params: [18], conjunction: "or" as const }],
    };
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
    // The user condition should be wrapped in parens before the OR
    expect(result.text).toContain("OR");
  });
});

// --- Phase 12: Subquery predicates integration ---

describe("compileQuery — subquery predicates", () => {
  test("should compile IN subquery predicate", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      subqueryPredicates: [
        {
          type: "in" as const,
          field: "id",
          sql: 'SELECT "t0"."id" FROM "app"."users" AS "t0" WHERE "t0"."age" > $1',
          params: [30],
          conjunction: "and" as const,
        },
      ],
    };
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("IN (");
  });

  test("should compile EXISTS subquery predicate", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      subqueryPredicates: [
        {
          type: "exists" as const,
          sql: 'SELECT 1 FROM "app"."orders" AS "t0" WHERE "t0"."user_id" = $1',
          params: ["user-1"],
          conjunction: "and" as const,
        },
      ],
    };
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("EXISTS (");
  });

  test("should compile NOT EXISTS subquery predicate", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      subqueryPredicates: [
        {
          type: "notExists" as const,
          sql: 'SELECT 1 FROM "app"."banned" AS "t0" WHERE "t0"."user_id" = $1',
          params: ["user-1"],
          conjunction: "and" as const,
        },
      ],
    };
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("NOT EXISTS (");
  });
});

// --- Phase 12: Lock mode ---

describe("compileQuery — lock mode", () => {
  test("should compile FOR UPDATE", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      lock: "pessimistic_write",
    };
    const result = compileQuery(state, metadata);
    expect(result.text).toContain("FOR UPDATE");
  });

  test("should compile FOR SHARE", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      lock: "pessimistic_read",
    };
    const result = compileQuery(state, metadata);
    expect(result.text).toContain("FOR SHARE");
  });

  test("should compile FOR UPDATE SKIP LOCKED", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      lock: "pessimistic_write_skip",
    };
    const result = compileQuery(state, metadata);
    expect(result.text).toContain("FOR UPDATE SKIP LOCKED");
  });

  test("should compile FOR UPDATE NOWAIT", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      lock: "pessimistic_write_fail",
    };
    const result = compileQuery(state, metadata);
    expect(result.text).toContain("FOR UPDATE NOWAIT");
  });

  test("should compile FOR SHARE SKIP LOCKED", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      lock: "pessimistic_read_skip",
    };
    const result = compileQuery(state, metadata);
    expect(result.text).toContain("FOR SHARE SKIP LOCKED");
  });

  test("should compile FOR SHARE NOWAIT", () => {
    const state: QueryState<any> = {
      ...createEmptyState(),
      lock: "pessimistic_read_fail",
    };
    const result = compileQuery(state, metadata);
    expect(result.text).toContain("FOR SHARE NOWAIT");
  });
});
