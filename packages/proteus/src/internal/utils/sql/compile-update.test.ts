import { makeField } from "../../__fixtures__/make-field.js";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import { postgresDialect } from "../../drivers/postgres/utils/postgres-dialect.js";
import { mysqlDialect } from "../../drivers/mysql/utils/mysql-dialect.js";
import { sqliteDialect } from "../../drivers/sqlite/utils/sqlite-dialect.js";
import type { SqlDialect } from "./sql-dialect.js";
import {
  type CompileUpdateDeps,
  type JoinedChildUpdateContext,
  compileUpdate,
  compileUpdateMany,
} from "./compile-update.js";
import type { DehydrateEntityFn } from "./write-compiler-deps.js";
import { describe, expect, test } from "vitest";

const dialects: Array<[string, SqlDialect]> = [
  ["postgres", postgresDialect],
  ["mysql", mysqlDialect],
  ["sqlite", sqliteDialect],
];

// Deterministic stand-in for the driver-specific dehydrators: one column per
// defined entity property, PKs excluded from UPDATE SET (like getSkipKeys).
const dehydrateEntity: DehydrateEntityFn = (entity, metadata, mode) =>
  metadata.fields
    .filter((f) => (entity as any)[f.key] !== undefined)
    .filter((f) => mode !== "update" || !metadata.primaryKeys.includes(f.key))
    .map((f) => ({ column: f.name, value: (entity as any)[f.key] }));

const makeDeps = (
  dialect: SqlDialect,
  joinedCtx: JoinedChildUpdateContext | null = null,
): CompileUpdateDeps => ({
  dehydrateEntity,
  coerceWriteValue: (value) => value,
  buildJoinedChildContext: () => joinedCtx,
  quoteChildTableName: (_metadata, namespace) =>
    dialect.quoteQualifiedName(
      dialect.supportsNamespace ? (namespace ?? null) : null,
      "dogs",
    ),
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
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

// No `inheritance` block: the joined strategies trigger on the injected context,
// and resolveTableName would otherwise require a registered root entity.
const joinedChildMetadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "animals",
    namespace: "app",
  },
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("breed", { type: "string" }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const makeJoinedCtx = (dialect: SqlDialect): JoinedChildUpdateContext => ({
  joinConditions: [
    `${dialect.quoteIdentifier("t1")}.${dialect.quoteIdentifier("id")} = ${dialect.quoteIdentifier("t0")}.${dialect.quoteIdentifier("id")}`,
  ],
  fieldAliasOverrides: new Map([["breed", "t1"]]),
  childFieldNames: new Set(["breed"]),
});

describe.each(dialects)("compileUpdate [%s]", (_name, dialect) => {
  test("should compile a single-row update with version lock", () => {
    const result = compileUpdate(
      { id: "1", name: "Alice", version: 3 } as any,
      metadata,
      dialect,
      makeDeps(dialect),
    );
    expect(result).toMatchSnapshot();
  });
});

describe.each(dialects)("compileUpdateMany [%s]", (_name, dialect) => {
  test("should compile a bulk update with criteria", () => {
    const result = compileUpdateMany(
      { name: "Alice" } as any,
      { name: "Bob" } as any,
      metadata,
      dialect,
      makeDeps(dialect),
    );
    expect(result).toMatchSnapshot();
  });

  test("should throw when update object has no valid columns", () => {
    expect(() =>
      compileUpdateMany(
        { name: "Alice" } as any,
        { nonexistent: "x" } as any,
        metadata,
        dialect,
        makeDeps(dialect),
      ),
    ).toThrow(/no valid columns in update object/);
  });

  test("should throw ProteusRepositoryError when criteria is empty", () => {
    expect(() =>
      compileUpdateMany(
        {} as any,
        { name: "Bob" } as any,
        metadata,
        dialect,
        makeDeps(dialect),
      ),
    ).toThrow(ProteusRepositoryError);
  });

  test("should compile the joined inheritance strategy for the dialect", () => {
    const result = compileUpdateMany(
      { name: "Rex" } as any,
      { breed: "Beagle" } as any,
      joinedChildMetadata,
      dialect,
      makeDeps(dialect, makeJoinedCtx(dialect)),
      "app",
    );
    expect(result).toMatchSnapshot();
  });

  test("should compile the joined inheritance strategy for root-only columns", () => {
    const result = compileUpdateMany(
      { breed: "Beagle" } as any,
      { name: "Rex" } as any,
      joinedChildMetadata,
      dialect,
      makeDeps(dialect, makeJoinedCtx(dialect)),
      "app",
    );
    expect(result).toMatchSnapshot();
  });
});
