import { makeField } from "../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import { postgresDialect } from "../../drivers/postgres/utils/postgres-dialect.js";
import { mysqlDialect } from "../../drivers/mysql/utils/mysql-dialect.js";
import { sqliteDialect } from "../../drivers/sqlite/utils/sqlite-dialect.js";
import type { SqlDialect } from "./sql-dialect.js";
import {
  type CompileInsertDeps,
  compileInsert,
  compileInsertBulk,
} from "./compile-insert.js";
import type { DehydrateEntityFn } from "./write-compiler-deps.js";
import { describe, expect, test } from "vitest";

const dialects: Array<[string, SqlDialect]> = [
  ["postgres", postgresDialect],
  ["mysql", mysqlDialect],
  ["sqlite", sqliteDialect],
];

// Deterministic stand-in for the driver-specific dehydrators: one column per
// defined entity property, no per-driver coercion.
const dehydrateEntity: DehydrateEntityFn = (entity, metadata) =>
  metadata.fields
    .filter((f) => (entity as any)[f.key] !== undefined)
    .map((f) => ({ column: f.name, value: (entity as any)[f.key] }));

const deps: CompileInsertDeps = { dehydrateEntity };

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
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

describe.each(dialects)("compileInsert [%s]", (_name, dialect) => {
  test("should compile insert with placeholders and returning per dialect", () => {
    const result = compileInsert(
      { id: "1", name: "Alice", email: "a@b.com" } as any,
      metadata,
      dialect,
      deps,
    );
    expect(result).toMatchSnapshot();
  });
});

describe.each(dialects)("compileInsertBulk [%s]", (_name, dialect) => {
  test("should compile a multi-row insert", () => {
    const result = compileInsertBulk(
      [
        { id: "1", name: "Alice", email: "a@b.com" },
        { id: "2", name: "Bob", email: "b@b.com" },
      ] as any,
      metadata,
      dialect,
      deps,
    );
    expect(result).toMatchSnapshot();
  });

  test("should throw when entities array is empty", () => {
    expect(() => compileInsertBulk([], metadata, dialect, deps)).toThrow(
      /entities array must not be empty/,
    );
  });
});
