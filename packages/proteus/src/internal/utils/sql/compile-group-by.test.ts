import { makeField } from "../../__fixtures__/make-field";
import type { EntityMetadata } from "../../entity/types/metadata";
import { postgresDialect } from "../../drivers/postgres/utils/postgres-dialect";
import { mysqlDialect } from "../../drivers/mysql/utils/mysql-dialect";
import { sqliteDialect } from "../../drivers/sqlite/utils/sqlite-dialect";
import type { SqlDialect } from "./sql-dialect";
import { compileGroupBy } from "./compile-group-by";
import { describe, expect, test } from "vitest";

const dialects: Array<[string, SqlDialect]> = [
  ["postgres", postgresDialect],
  ["mysql", mysqlDialect],
  ["sqlite", sqliteDialect],
];

const metadata = {
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("department", { type: "string", name: "dept_code" }),
    makeField("age", { type: "integer" }),
  ],
  relations: [],
} as unknown as EntityMetadata;

describe.each(dialects)("compileGroupBy [%s]", (_name, dialect) => {
  test("should return empty string when groupBy is null", () => {
    const result = compileGroupBy(null, metadata, "t0", dialect);
    expect(result).toBe("");
  });

  test("should return empty string when groupBy is empty array", () => {
    const result = compileGroupBy([], metadata, "t0", dialect);
    expect(result).toBe("");
  });

  test("should compile single field groupBy", () => {
    const result = compileGroupBy(["name"], metadata, "t0", dialect);
    expect(result).toMatchSnapshot();
  });

  test("should compile multiple field groupBy", () => {
    const result = compileGroupBy(["name", "age"], metadata, "t0", dialect);
    expect(result).toMatchSnapshot();
  });

  test("should use column name mapping", () => {
    const result = compileGroupBy(["department"], metadata, "t0", dialect);
    expect(result).toMatchSnapshot();
  });
});
