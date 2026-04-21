import { makeField } from "../../../../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../../../../entity/types/metadata.js";
import { createEmptyState } from "../../../../../../classes/QueryBuilder.js";
import { compileQuery, compileCount } from "../compile-query.js";
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
  generated: [],
  filters: [],
  defaultOrder: null,
} as unknown as EntityMetadata;

describe("compileQuery", () => {
  test("should compile a basic SELECT query", () => {
    const state = createEmptyState<any>();
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
    // Should use backtick quoting
    expect(result.text).toContain("`t0`");
    expect(result.text).toContain("`app`.`users`");
  });

  test("should compile SELECT with WHERE", () => {
    const state = createEmptyState<any>();
    state.predicates = [{ predicate: { name: "Alice" }, conjunction: "and" }];
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
  });

  test("should compile SELECT with ORDER BY (NULLS LAST emulation)", () => {
    const state = createEmptyState<any>();
    state.orderBy = { name: "ASC" };
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("IS NULL");
  });

  test("should compile SELECT with LIMIT and OFFSET", () => {
    const state = createEmptyState<any>();
    state.take = 10;
    state.skip = 20;
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("LIMIT ?");
    expect(result.text).toContain("OFFSET ?");
  });

  test("should compile SELECT with lock mode", () => {
    const state = createEmptyState<any>();
    state.lock = "pessimistic_write";
    const result = compileQuery(state, metadata);
    expect(result.text).toContain("FOR UPDATE");
  });

  test("should compile SELECT with FOR SHARE lock", () => {
    const state = createEmptyState<any>();
    state.lock = "pessimistic_read";
    const result = compileQuery(state, metadata);
    expect(result.text).toContain("FOR SHARE");
  });

  test("should compile SELECT with SKIP LOCKED", () => {
    const state = createEmptyState<any>();
    state.lock = "pessimistic_write_skip";
    const result = compileQuery(state, metadata);
    expect(result.text).toContain("FOR UPDATE SKIP LOCKED");
  });

  test("should compile DISTINCT SELECT", () => {
    const state = createEmptyState<any>();
    state.distinct = true;
    const result = compileQuery(state, metadata);
    expect(result.text).toContain("SELECT DISTINCT");
  });

  test("should compile SELECT with GROUP BY", () => {
    const state = createEmptyState<any>();
    state.groupBy = ["name"];
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("GROUP BY");
    expect(result.text).toContain("`t0`.`name`");
  });

  test("should compile SELECT with GROUP BY and HAVING", () => {
    const state = createEmptyState<any>();
    state.groupBy = ["name"];
    state.having = [{ predicate: { age: { $gt: 5 } }, conjunction: "and" }];
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("GROUP BY");
    expect(result.text).toContain("HAVING");
  });

  test("should compile SELECT with CTE (WITH clause)", () => {
    const state = createEmptyState<any>();
    state.ctes = [
      {
        name: "active_users",
        sql: "SELECT * FROM `app`.`users` WHERE `age` > ?",
        params: [18],
        materialized: null,
      },
    ];
    state.cteFrom = "active_users";
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("WITH");
    expect(result.text).toContain("`active_users`");
    expect(result.params).toContain(18);
  });

  test("should compile SELECT with multiple CTEs", () => {
    const state = createEmptyState<any>();
    state.ctes = [
      {
        name: "cte1",
        sql: "SELECT * FROM `app`.`users` WHERE `age` > ?",
        params: [18],
        materialized: null,
      },
      {
        name: "cte2",
        sql: "SELECT * FROM `app`.`users` WHERE `name` = ?",
        params: ["Alice"],
        materialized: null,
      },
    ];
    const result = compileQuery(state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("WITH");
    expect(result.text).toContain("`cte1`");
    expect(result.text).toContain("`cte2`");
    expect(result.params).toEqual([18, "Alice"]);
  });
});

describe("compileCount", () => {
  test("should compile COUNT(*) query", () => {
    const state = createEmptyState<any>();
    const result = compileCount(state, metadata);
    expect(result).toMatchSnapshot();
    expect(result.text).toContain("COUNT(*)");
    expect(result.text).toContain("`count`");
  });

  test("should compile COUNT with WHERE", () => {
    const state = createEmptyState<any>();
    state.predicates = [{ predicate: { age: { $gt: 18 } }, conjunction: "and" }];
    const result = compileCount(state, metadata);
    expect(result).toMatchSnapshot();
  });
});
