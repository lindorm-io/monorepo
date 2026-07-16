import type {
  DesiredColumn,
  DesiredConstraint,
  DesiredIndex,
  DesiredSchema,
  DesiredTable,
} from "../../types/desired-schema.js";
import type {
  DesiredColumnModel,
  DesiredForeignKeyModel,
  DesiredIndexModel,
  DesiredSchemaModel,
  DesiredTableModel,
} from "../../../../utils/sync/desired-schema-model.js";

/**
 * Purely mechanical mapping (rename / regroup / default — zero decisions) from
 * the shared `DesiredSchemaModel` onto the postgres `DesiredSchema` types.
 * Reconstructs the historical constraint ordering from FK provenance
 * (PK → inheritance FK → uniques → checks → remaining FKs) and emits the
 * `opclass` key only on user-index columns — both snapshot-locked.
 */

const mapColumn = (column: DesiredColumnModel): DesiredColumn => ({
  name: column.name,
  pgType: column.columnType,
  nullable: column.nullable,
  defaultExpr: column.defaultExpr,
  isIdentity: column.identity === "identity" || column.identity === "identity_always",
  identityGeneration:
    column.identity === "identity_always"
      ? "ALWAYS"
      : column.identity === "identity"
        ? "BY DEFAULT"
        : null,
  isGenerated: column.generatedExpr !== null,
  generationExpr: column.generatedExpr,
  collation: column.collation,
});

const mapForeignKey = (fk: DesiredForeignKeyModel): DesiredConstraint => ({
  name: fk.name!,
  type: "FOREIGN KEY",
  columns: fk.columns,
  foreignSchema: fk.foreignNamespace ?? "public",
  foreignTable: fk.foreignTable,
  foreignColumns: fk.foreignColumns,
  onDelete: fk.onDelete,
  onUpdate: fk.onUpdate,
  checkExpr: null,
  deferrable: fk.deferrable,
  initiallyDeferred: fk.initiallyDeferred,
});

const mapIndex = (index: DesiredIndexModel): DesiredIndex => ({
  name: index.name,
  unique: index.unique,
  columns: index.columns.map((c) =>
    index.origin === "user"
      ? { name: c.name, direction: c.direction, opclass: c.opclass }
      : { name: c.name, direction: c.direction },
  ),
  method: index.method,
  where: index.where,
  include: index.include,
  concurrent: index.concurrent,
});

const mapTable = (table: DesiredTableModel): DesiredTable => {
  const constraints: Array<DesiredConstraint> = [];

  if (table.primaryKey) {
    constraints.push({
      name: `${table.name}_pkey`,
      type: "PRIMARY KEY",
      columns: table.primaryKey.columns,
      foreignSchema: null,
      foreignTable: null,
      foreignColumns: null,
      onDelete: null,
      onUpdate: null,
      checkExpr: null,
      deferrable: false,
      initiallyDeferred: false,
    });
  }

  for (const fk of table.foreignKeys) {
    if (fk.kind !== "inheritance") continue;
    constraints.push(mapForeignKey(fk));
  }

  for (const unique of table.uniques) {
    constraints.push({
      name: unique.name,
      type: "UNIQUE",
      columns: unique.columns.map((c) => c.name),
      foreignSchema: null,
      foreignTable: null,
      foreignColumns: null,
      onDelete: null,
      onUpdate: null,
      checkExpr: null,
      deferrable: false,
      initiallyDeferred: false,
    });
  }

  for (const check of table.checks) {
    constraints.push({
      name: check.name,
      type: "CHECK",
      columns: [],
      foreignSchema: null,
      foreignTable: null,
      foreignColumns: null,
      onDelete: null,
      onUpdate: null,
      checkExpr: `CHECK (${check.expression})`,
      deferrable: false,
      initiallyDeferred: false,
    });
  }

  for (const fk of table.foreignKeys) {
    if (fk.kind === "inheritance") continue;
    constraints.push(mapForeignKey(fk));
  }

  return {
    schema: table.namespace ?? "public",
    name: table.name,
    columns: table.columns.map(mapColumn),
    constraints,
    indexes: table.indexes.map(mapIndex),
    comment: table.comment,
    columnComments: table.columnComments,
    triggers: table.triggers.map((t) => ({ name: t.name, statements: t.statements })),
  };
};

export const mapDesiredSchema = (model: DesiredSchemaModel): DesiredSchema => ({
  tables: model.tables.map(mapTable),
  enums: model.enums.map((e) => ({ schema: e.schema, name: e.name, values: e.values })),
  schemas: model.namespaces,
  extensions: model.extensions,
});
