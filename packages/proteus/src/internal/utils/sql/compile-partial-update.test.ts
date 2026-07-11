import { makeField } from "../../__fixtures__/make-field.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import { postgresDialect } from "../../drivers/postgres/utils/postgres-dialect.js";
import { mysqlDialect } from "../../drivers/mysql/utils/mysql-dialect.js";
import { sqliteDialect } from "../../drivers/sqlite/utils/sqlite-dialect.js";
import type { SqlDialect } from "./sql-dialect.js";
import {
  type CompilePartialUpdateDeps,
  compilePartialUpdate,
} from "./compile-partial-update.js";
import { describe, expect, test } from "vitest";

const dialects: Array<[string, SqlDialect]> = [
  ["postgres", postgresDialect],
  ["mysql", mysqlDialect],
  ["sqlite", sqliteDialect],
];

const makeDeps = (dialect: SqlDialect): CompilePartialUpdateDeps => ({
  coerceWriteValue: (value) => value,
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
    makeField("updatedAt", {
      type: "timestamp",
      name: "updated_at",
      decorator: "UpdateDate",
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const transformMetadata = {
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
    makeField("name", {
      type: "string",
      transform: { to: (v: unknown) => String(v).toUpperCase(), from: (v: unknown) => v },
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
} as unknown as EntityMetadata;

const entity = {
  id: "1",
  name: "Alice",
  version: 3,
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
} as any;

describe.each(dialects)("compilePartialUpdate [%s]", (_name, dialect) => {
  test("should compile changed columns plus version and update date", () => {
    const result = compilePartialUpdate(
      entity,
      metadata,
      { name: "Bob" },
      dialect,
      makeDeps(dialect),
    );
    expect(result).toMatchSnapshot();
  });

  test("should not re-add version or update date when already in changed dict", () => {
    const result = compilePartialUpdate(
      entity,
      metadata,
      { name: "Bob", version: 3, updated_at: entity.updatedAt },
      dialect,
      makeDeps(dialect),
    );
    expect(result).toMatchSnapshot();
  });

  test("should apply field transforms to changed values", () => {
    const result = compilePartialUpdate(
      { id: "1" } as any,
      transformMetadata,
      { name: "bob" },
      dialect,
      makeDeps(dialect),
    );
    expect(result).toMatchSnapshot();
  });
});
