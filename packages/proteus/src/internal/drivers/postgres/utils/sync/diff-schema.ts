import type { DbSnapshot } from "../../types/db-snapshot";
import type { DesiredSchema } from "../../types/desired-schema";
import type { SyncOperation, SyncPlan } from "../../types/sync-plan";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";
import { diffColumns } from "./diff-columns";
import { diffComments } from "./diff-comments";
import { diffConstraints } from "./diff-constraints";
import { diffEnums } from "./diff-enums";
import { diffIndexes } from "./diff-indexes";

// Execution ordering from the design doc — determines sort order
const OPERATION_ORDER: Record<string, number> = {
  create_extension: 1,
  create_schema: 2,
  create_enum: 3,
  create_table: 4,
  // Drop FKs first to unblock changes
  drop_constraint_fk: 5,
  drop_constraint: 6,
  drop_index: 7,
  // Backfill + column changes
  backfill_column: 8,
  add_column: 9,
  alter_column_type: 10,
  alter_column_identity: 10,
  alter_column_nullable: 11,
  alter_column_default: 12,
  drop_and_readd_column: 10,
  drop_column: 13,
  // Re-add constraints
  add_constraint: 14,
  add_constraint_fk: 15,
  create_index: 16,
  set_comment: 17,
  warn_only: 18,
  // Autocommit phase
  add_enum_value: 19,
};

const getOperationOrder = (op: SyncOperation): number => {
  // Distinguish FK constraint drops/adds for ordering via constraintType field
  if (op.type === "drop_constraint" && op.constraintType === "FOREIGN KEY") {
    return OPERATION_ORDER.drop_constraint_fk;
  }
  if (op.type === "add_constraint" && op.constraintType === "FOREIGN KEY") {
    return OPERATION_ORDER.add_constraint_fk;
  }
  return OPERATION_ORDER[op.type] ?? 99;
};

/**
 * Produces a sorted list of sync operations by diffing the current DB snapshot against
 * the desired schema. Covers extensions, schemas, enums, tables (create + alter columns/
 * constraints/indexes/comments). Operations are sorted by execution order to respect
 * PostgreSQL dependency requirements (e.g. drop FKs before column changes, re-add after).
 */
export const diffSchema = (snapshot: DbSnapshot, desired: DesiredSchema): SyncPlan => {
  const ops: Array<SyncOperation> = [];

  // Extensions
  for (const ext of desired.extensions) {
    ops.push({
      type: "create_extension",
      severity: "safe",
      schema: null,
      table: null,
      description: `Create extension ${quoteIdentifier(ext)}`,
      sql: `CREATE EXTENSION IF NOT EXISTS ${quoteIdentifier(ext)};`,
      autocommit: false,
    });
  }

  // Schemas
  for (const schema of desired.schemas) {
    if (!snapshot.schemas.includes(schema)) {
      ops.push({
        type: "create_schema",
        severity: "safe",
        schema,
        table: null,
        description: `Create schema ${quoteIdentifier(schema)}`,
        sql: `CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(schema)};`,
        autocommit: false,
      });
    }
  }

  // Enums
  ops.push(...diffEnums(snapshot.enums, desired.enums));

  // Tables
  for (const desiredTable of desired.tables) {
    const dbTable = snapshot.tables.find(
      (t) => t.schema === desiredTable.schema && t.name === desiredTable.name,
    );

    if (!dbTable) {
      // New table — generate full CREATE TABLE
      const q = quoteQualifiedName(desiredTable.schema, desiredTable.name);
      const colDefs: Array<string> = [];

      for (const col of desiredTable.columns) {
        let def = `${quoteIdentifier(col.name)} ${col.pgType}`;
        if (col.isGenerated && col.generationExpr) {
          def += ` GENERATED ALWAYS AS (${col.generationExpr}) STORED`;
        } else if (col.isIdentity) {
          def += ` GENERATED ${col.identityGeneration ?? "ALWAYS"} AS IDENTITY`;
        } else {
          if (col.collation) def += ` COLLATE ${quoteIdentifier(col.collation)}`;
          if (col.defaultExpr) def += ` DEFAULT ${col.defaultExpr}`;
          if (!col.nullable) def += " NOT NULL";
        }
        colDefs.push(def);
      }

      // Inline PK
      const pk = desiredTable.constraints.find((c) => c.type === "PRIMARY KEY");
      if (pk) {
        colDefs.push(
          `CONSTRAINT ${quoteIdentifier(pk.name)} PRIMARY KEY (${pk.columns.map((c) => quoteIdentifier(c)).join(", ")})`,
        );
      }

      // Inline CHECK + UNIQUE
      for (const c of desiredTable.constraints) {
        if (c.type === "CHECK") {
          colDefs.push(`CONSTRAINT ${quoteIdentifier(c.name)} ${c.checkExpr}`);
        } else if (c.type === "UNIQUE") {
          colDefs.push(
            `CONSTRAINT ${quoteIdentifier(c.name)} UNIQUE (${c.columns.map((col) => quoteIdentifier(col)).join(", ")})`,
          );
        }
      }

      const body = colDefs.map((l) => `  ${l}`).join(",\n");
      ops.push({
        type: "create_table",
        severity: "safe",
        schema: desiredTable.schema,
        table: desiredTable.name,
        description: `Create table ${q}`,
        sql: `CREATE TABLE ${q} (\n${body}\n);`,
        autocommit: false,
      });

      // FK constraints for new table (added separately, after all tables exist)
      for (const c of desiredTable.constraints) {
        if (c.type !== "FOREIGN KEY") continue;
        const cols = c.columns.map((col) => quoteIdentifier(col)).join(", ");
        const refTable = c.foreignSchema
          ? quoteQualifiedName(c.foreignSchema, c.foreignTable!)
          : quoteIdentifier(c.foreignTable!);
        const refCols = (c.foreignColumns ?? [])
          .map((col) => quoteIdentifier(col))
          .join(", ");
        const onDelete = c.onDelete ? ` ON DELETE ${c.onDelete}` : "";
        const onUpdate = c.onUpdate ? ` ON UPDATE ${c.onUpdate}` : "";
        const deferrable = c.deferrable
          ? c.initiallyDeferred
            ? " DEFERRABLE INITIALLY DEFERRED"
            : " DEFERRABLE INITIALLY IMMEDIATE"
          : "";

        ops.push({
          type: "add_constraint",
          severity: "safe",
          schema: desiredTable.schema,
          table: desiredTable.name,
          description: `Add FOREIGN KEY ${quoteIdentifier(c.name)} on ${q}`,
          sql: `ALTER TABLE ${q} ADD CONSTRAINT ${quoteIdentifier(c.name)} FOREIGN KEY (${cols}) REFERENCES ${refTable} (${refCols})${onDelete}${onUpdate}${deferrable};`,
          autocommit: false,
          constraintType: "FOREIGN KEY",
        });
      }

      // Indexes for new table
      for (const idx of desiredTable.indexes) {
        const unique = idx.unique ? "UNIQUE " : "";
        const concurrent = idx.concurrent ? "CONCURRENTLY " : "";
        const cols = idx.columns
          .map((c) => `${quoteIdentifier(c.name)} ${c.direction.toUpperCase()}`)
          .join(", ");
        let using = "";
        if (idx.method && idx.method !== "btree") using = ` USING ${idx.method}`;
        let stmt = `CREATE ${unique}INDEX ${concurrent}${quoteIdentifier(idx.name)} ON ${q}${using} (${cols})`;
        if (idx.include && idx.include.length > 0) {
          stmt += ` INCLUDE (${idx.include.map((c) => quoteIdentifier(c)).join(", ")})`;
        }
        if (idx.where) stmt += ` WHERE ${idx.where}`;
        ops.push({
          type: "create_index",
          severity: "safe",
          schema: desiredTable.schema,
          table: desiredTable.name,
          description: `Create index ${quoteIdentifier(idx.name)} on ${q}`,
          sql: `${stmt};`,
          autocommit: idx.concurrent,
        });
      }

      // Comments for new table
      if (desiredTable.comment) {
        const escaped = desiredTable.comment.replace(/'/g, "''");
        ops.push({
          type: "set_comment",
          severity: "safe",
          schema: desiredTable.schema,
          table: desiredTable.name,
          description: `Set comment on table ${q}`,
          sql: `COMMENT ON TABLE ${q} IS '${escaped}';`,
          autocommit: false,
        });
      }
      for (const [col, comment] of Object.entries(desiredTable.columnComments)) {
        const escaped = comment.replace(/'/g, "''");
        ops.push({
          type: "set_comment",
          severity: "safe",
          schema: desiredTable.schema,
          table: desiredTable.name,
          description: `Set comment on column ${q}.${quoteIdentifier(col)}`,
          sql: `COMMENT ON COLUMN ${q}.${quoteIdentifier(col)} IS '${escaped}';`,
          autocommit: false,
        });
      }

      continue;
    }

    // Existing table — diff each aspect
    ops.push(
      ...diffColumns(
        dbTable.columns,
        desiredTable.columns,
        desiredTable.schema,
        desiredTable.name,
      ),
    );
    ops.push(
      ...diffConstraints(
        dbTable.constraints,
        desiredTable.constraints,
        desiredTable.schema,
        desiredTable.name,
      ),
    );
    ops.push(
      ...diffIndexes(
        dbTable.indexes,
        desiredTable.indexes,
        desiredTable.schema,
        desiredTable.name,
      ),
    );
    ops.push(...diffComments(dbTable, desiredTable));
  }

  // Sort operations by execution order
  ops.sort((a, b) => getOperationOrder(a) - getOperationOrder(b));

  const summary = {
    safe: ops.filter((o) => o.severity === "safe").length,
    warning: ops.filter((o) => o.severity === "warning").length,
    destructive: ops.filter((o) => o.severity === "destructive").length,
    total: ops.length,
  };

  return { operations: ops, summary };
};
