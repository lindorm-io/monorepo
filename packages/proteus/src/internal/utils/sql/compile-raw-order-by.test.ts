import { describe, expect, test } from "vitest";
import { postgresDialect } from "../../drivers/postgres/utils/postgres-dialect.js";
import { sqliteDialect } from "../../drivers/sqlite/utils/sqlite-dialect.js";
import { compileRawOrderTerms } from "./compile-raw-order-by.js";

describe("compileRawOrderTerms", () => {
  test("returns an empty array for no entries", () => {
    const params: Array<unknown> = [];
    expect(compileRawOrderTerms([], params, sqliteDialect)).toEqual([]);
    expect(params).toEqual([]);
  });

  test("returns one clause per entry, in order", () => {
    const params: Array<unknown> = [];
    const clauses = compileRawOrderTerms(
      [
        { sql: "n DESC", params: [] },
        { sql: "name ASC", params: [] },
      ],
      params,
      sqliteDialect,
    );
    expect(clauses).toEqual(["n DESC", "name ASC"]);
  });

  test("positional dialect appends params and keeps text verbatim", () => {
    const params: Array<unknown> = ["pre"];
    const clauses = compileRawOrderTerms(
      [{ sql: "score > ? DESC", params: [10] }],
      params,
      sqliteDialect,
    );
    expect(clauses).toEqual(["score > ? DESC"]);
    expect(params).toEqual(["pre", 10]);
  });

  test("postgres dialect reindexes $N placeholders past existing params", () => {
    const params: Array<unknown> = ["pre"];
    const clauses = compileRawOrderTerms(
      [{ sql: "score > $1 DESC", params: [10] }],
      params,
      postgresDialect,
    );
    expect(clauses).toEqual(["score > $2 DESC"]);
    expect(params).toEqual(["pre", 10]);
  });
});
