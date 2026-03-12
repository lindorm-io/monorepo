import type { CompiledSql } from "./compiled-sql";

// compiled-sql.ts only exports a type — these tests verify the structural
// contract of CompiledSql objects constructed inline.

describe("CompiledSql type", () => {
  test("accepts a minimal valid CompiledSql object", () => {
    const sql: CompiledSql = { text: "SELECT 1", params: [] };
    expect(sql).toMatchSnapshot();
  });

  test("accepts CompiledSql with non-empty params", () => {
    const sql: CompiledSql = {
      text: 'SELECT * FROM "users" WHERE "id" = $1',
      params: ["abc-123"],
    };
    expect(sql).toMatchSnapshot();
  });

  test("accepts CompiledSql with multiple params of mixed types", () => {
    const sql: CompiledSql = {
      text: 'SELECT * FROM "users" WHERE "name" = $1 AND "age" > $2 AND "active" = $3',
      params: ["Alice", 18, true],
    };
    expect(sql).toMatchSnapshot();
  });

  test("accepts CompiledSql with null param values", () => {
    const sql: CompiledSql = {
      text: 'UPDATE "users" SET "deleted_at" = $1 WHERE "id" = $2',
      params: [null, "abc-123"],
    };
    expect(sql).toMatchSnapshot();
  });

  test("accepts CompiledSql with Date param values", () => {
    const date = new Date("2024-01-01T00:00:00Z");
    const sql: CompiledSql = {
      text: 'INSERT INTO "events" ("occurred_at") VALUES ($1)',
      params: [date],
    };
    expect(sql.params[0]).toBeInstanceOf(Date);
    expect(sql.text).toMatchSnapshot();
  });

  test("params array is mutable — values can be pushed", () => {
    const sql: CompiledSql = { text: "SELECT $1", params: [] };
    sql.params.push("hello");
    expect(sql.params).toHaveLength(1);
    expect(sql.params[0]).toBe("hello");
  });
});
