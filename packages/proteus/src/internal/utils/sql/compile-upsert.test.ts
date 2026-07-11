import { makeField } from "../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import { postgresDialect } from "../../drivers/postgres/utils/postgres-dialect.js";
import { mysqlDialect } from "../../drivers/mysql/utils/mysql-dialect.js";
import { sqliteDialect } from "../../drivers/sqlite/utils/sqlite-dialect.js";
import type { SqlDialect } from "./sql-dialect.js";
import { type CompileUpsertDeps, compileUpsert } from "./compile-upsert.js";
import type { DehydrateEntityFn } from "./write-compiler-deps.js";
import { describe, expect, test } from "vitest";

const dialects: Array<[string, SqlDialect]> = [
  ["postgres", postgresDialect],
  ["mysql", mysqlDialect],
  ["sqlite", sqliteDialect],
];

// Deterministic stand-in for the driver-specific dehydrators
const dehydrateEntity: DehydrateEntityFn = (entity, metadata) =>
  metadata.fields
    .filter((f) => (entity as any)[f.key] !== undefined)
    .map((f) => ({ column: f.name, value: (entity as any)[f.key] }));

const makeDeps = (dialect: SqlDialect): CompileUpsertDeps => ({
  dehydrateEntity,
  resolveConflictColumns: (metadata, conflictColumns) =>
    (conflictColumns ?? metadata.primaryKeys).map((col) => {
      const field = metadata.fields.find((f) => f.key === col);
      return dialect.quoteIdentifier(field?.name ?? col);
    }),
});

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
    makeField("version", { type: "integer", decorator: "Version" }),
    makeField("updatedAt", {
      type: "timestamp",
      name: "updated_at",
      decorator: "UpdateDate",
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
  generated: [],
} as unknown as EntityMetadata;

const joinedChildMetadata = {
  ...metadata,
  inheritance: {
    strategy: "joined",
    root: class Animal {},
    discriminatorField: "type",
    discriminatorValue: "dog",
  },
} as unknown as EntityMetadata;

const entity = {
  id: "1",
  name: "Alice",
  version: 1,
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
} as any;

describe.each(dialects)("compileUpsert [%s]", (_name, dialect) => {
  test("should compile the dialect's conflict clause with version bump and now-expression", () => {
    const result = compileUpsert(entity, metadata, dialect, makeDeps(dialect));
    expect(result).toMatchSnapshot();
  });

  test("should use explicit conflict columns when provided", () => {
    const result = compileUpsert(entity, metadata, dialect, makeDeps(dialect), null, {
      conflictColumns: ["name"],
    });
    expect(result).toMatchSnapshot();
  });

  test("should throw for joined inheritance children", () => {
    expect(() =>
      compileUpsert(entity, joinedChildMetadata, dialect, makeDeps(dialect)),
    ).toThrow(/not supported for joined inheritance/);
  });
});
