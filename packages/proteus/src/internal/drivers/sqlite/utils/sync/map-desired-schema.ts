import type {
  SqliteDesiredColumn,
  SqliteDesiredForeignKey,
  SqliteDesiredIndex,
  SqliteDesiredSchema,
  SqliteDesiredTable,
} from "../../types/desired-schema.js";
import type {
  DesiredColumnModel,
  DesiredForeignKeyModel,
  DesiredIndexModel,
  DesiredSchemaModel,
  DesiredTableModel,
} from "../../../../utils/sync/desired-schema-model.js";
import { quoteIdentifier } from "../quote-identifier.js";

/**
 * Purely mechanical mapping (rename / regroup / drop — zero decisions) from
 * the shared `DesiredSchemaModel` onto the SQLite `SqliteDesiredSchema` types.
 * Drops namespaces/enums/extensions/comments, FK names (inline unnamed FKs),
 * and index method/opclass/include — all known sqlite drift, kept. Computed
 * columns (`GENERATED ALWAYS AS ... STORED`) and deferrable FKs are carried:
 * sqlite supports both. The optional `computed` key is emitted ONLY on
 * field-origin columns — snapshot-locked (collection element columns drop it).
 * Table checks are rendered as `CONSTRAINT "name" CHECK (expr)` strings;
 * triggers collapse to single-DDL.
 */

const mapColumn = (column: DesiredColumnModel): SqliteDesiredColumn => {
  const mapped: SqliteDesiredColumn = {
    name: column.name,
    sqliteType: column.columnType,
    nullable: column.nullable,
    defaultExpr: column.defaultExpr,
    isAutoincrement: column.identity === "auto_increment",
    checkExpr: column.checkExpr,
  };

  if (column.origin === "field") {
    mapped.computed = column.generatedExpr;
  }

  return mapped;
};

const mapForeignKey = (fk: DesiredForeignKeyModel): SqliteDesiredForeignKey => ({
  columns: fk.columns,
  foreignTable: fk.foreignTable,
  foreignColumns: fk.foreignColumns,
  onDelete: fk.onDelete,
  onUpdate: fk.onUpdate,
  deferrable: fk.deferrable,
  initiallyDeferred: fk.initiallyDeferred,
});

const mapIndex = (index: DesiredIndexModel): SqliteDesiredIndex => ({
  name: index.name,
  unique: index.unique,
  columns: index.columns.map((c) => ({ name: c.name, direction: c.direction })),
  where: index.where,
});

const mapTable = (table: DesiredTableModel): SqliteDesiredTable => ({
  name: table.name,
  columns: table.columns.map(mapColumn),
  primaryKeys: table.primaryKey?.columns ?? [],
  foreignKeys: table.foreignKeys.map(mapForeignKey),
  uniqueConstraints: table.uniques.map((u) => ({
    name: u.name,
    columns: u.columns.map((c) => c.name),
  })),
  checkConstraints: table.checks.map(
    (c) => `CONSTRAINT ${quoteIdentifier(c.name)} CHECK (${c.expression})`,
  ),
  indexes: table.indexes.map(mapIndex),
  triggers: table.triggers.map((t) => ({ name: t.name, ddl: t.statements[0] })),
});

export const mapDesiredSchema = (model: DesiredSchemaModel): SqliteDesiredSchema => ({
  tables: model.tables.map(mapTable),
});
