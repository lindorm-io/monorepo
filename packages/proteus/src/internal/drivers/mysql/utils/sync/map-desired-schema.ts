import type {
  MysqlDesiredColumn,
  MysqlDesiredForeignKey,
  MysqlDesiredIndex,
  MysqlDesiredSchema,
  MysqlDesiredTable,
} from "../../types/desired-schema.js";
import type {
  DesiredColumnModel,
  DesiredForeignKeyModel,
  DesiredIndexModel,
  DesiredSchemaModel,
  DesiredTableModel,
} from "../../../../utils/sync/desired-schema-model.js";
import { MySqlSyncError } from "../../errors/MySqlSyncError.js";

/**
 * Purely mechanical mapping (rename / regroup / drop — zero decisions) from
 * the shared `DesiredSchemaModel` onto the MySQL `MysqlDesiredSchema` types.
 * Drops namespaces/enums/extensions/comments and index where/method/include
 * (mysql cannot express them); emits the optional `computed` key ONLY on
 * field-origin columns — snapshot-locked (collection element columns drop it).
 * A DEFERRABLE foreign key throws — InnoDB has no deferred constraints, and a
 * silent immediate FK would break intentional out-of-order/circular inserts.
 */

const mapColumn = (column: DesiredColumnModel): MysqlDesiredColumn => {
  const mapped: MysqlDesiredColumn = {
    name: column.name,
    mysqlType: column.columnType,
    nullable: column.nullable,
    defaultExpr: column.defaultExpr,
    isAutoIncrement: column.identity === "auto_increment",
    enumValues: column.enumValues,
  };

  if (column.origin === "field") {
    mapped.computed = column.generatedExpr;
  }

  return mapped;
};

const mapForeignKey = (fk: DesiredForeignKeyModel): MysqlDesiredForeignKey => {
  if (fk.deferrable) {
    throw new MySqlSyncError(
      `Deferrable foreign key "${fk.name ?? fk.columns.join(", ")}" is not supported by MySQL InnoDB`,
      {
        code: "unsupported_operation",
        title: "Unsupported Operation",
        details:
          "MySQL InnoDB does not support DEFERRABLE foreign key constraints; declare the relation without @Deferrable, or run on a driver that supports it (postgres/sqlite).",
      },
    );
  }

  return {
    constraintName: fk.name!,
    columns: fk.columns,
    foreignTable: fk.foreignTable,
    foreignColumns: fk.foreignColumns,
    onDelete: fk.onDelete,
    onUpdate: fk.onUpdate,
  };
};

const mapIndex = (index: DesiredIndexModel): MysqlDesiredIndex => ({
  name: index.name,
  unique: index.unique,
  columns: index.columns.map((c) => ({
    name: c.name,
    direction: c.direction,
    prefixLength: c.prefixLength,
  })),
});

const mapTable = (table: DesiredTableModel): MysqlDesiredTable => ({
  name: table.name,
  columns: table.columns.map(mapColumn),
  primaryKeys: table.primaryKey?.columns ?? [],
  foreignKeys: table.foreignKeys.map(mapForeignKey),
  uniqueConstraints: table.uniques.map((u) => ({
    name: u.name,
    columns: u.columns.map((c) => ({ name: c.name, prefixLength: c.prefixLength })),
  })),
  checkConstraints: table.checks.map((c) => ({ name: c.name, expression: c.expression })),
  indexes: table.indexes.map(mapIndex),
  triggers: table.triggers.map((t) => ({ name: t.name, statements: t.statements })),
});

export const mapDesiredSchema = (model: DesiredSchemaModel): MysqlDesiredSchema => ({
  tables: model.tables.map(mapTable),
});
