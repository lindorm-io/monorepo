import { isEqual } from "@lindorm/is";
import type { DbConstraint } from "../../types/db-snapshot.js";
import type { DesiredConstraint } from "../../types/desired-schema.js";
import type { SyncOperation } from "../../types/sync-plan.js";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier.js";

const constraintMatches = (db: DbConstraint, desired: DesiredConstraint): boolean => {
  if (db.type !== desired.type) return false;

  // Skip column comparison for CHECK — PG populates conkey from the
  // expression, but we store columns: [] in the desired schema.
  if (desired.type !== "CHECK") {
    if (!isEqual([...db.columns].sort(), [...desired.columns].sort())) return false;
  }

  if (desired.type === "FOREIGN KEY") {
    if (db.foreignSchema !== desired.foreignSchema) return false;
    if (db.foreignTable !== desired.foreignTable) return false;
    if (!isEqual(db.foreignColumns?.sort(), desired.foreignColumns?.sort())) return false;
    if (db.onDelete !== desired.onDelete) return false;
    if (db.onUpdate !== desired.onUpdate) return false;
    if (db.deferrable !== desired.deferrable) return false;
    if (db.initiallyDeferred !== desired.initiallyDeferred) return false;
  }

  // CHECK expressions are NOT compared because PG canonicalizes them
  // (e.g. BETWEEN → AND, extra parens). Auto-generated constraint names
  // include a hash of the expression, so expression changes = name changes.

  return true;
};

/**
 * Diffs DB constraints against desired constraints. Handles PRIMARY KEY, UNIQUE,
 * CHECK, and FOREIGN KEY types. FK constraints include ON DELETE/UPDATE actions
 * and DEFERRABLE clause comparison. Mismatched constraints are dropped and re-added.
 */
export const diffConstraints = (
  dbConstraints: Array<DbConstraint>,
  desiredConstraints: Array<DesiredConstraint>,
  schema: string,
  table: string,
): Array<SyncOperation> => {
  const ops: Array<SyncOperation> = [];
  const q = quoteQualifiedName(schema, table);

  const dbByName = new Map(dbConstraints.map((c) => [c.name, c]));
  const desiredByName = new Map(desiredConstraints.map((c) => [c.name, c]));

  // Drop constraints that no longer exist or have changed
  for (const [name, db] of dbByName) {
    const desired = desiredByName.get(name);

    if (!desired || !constraintMatches(db, desired)) {
      ops.push({
        type: "drop_constraint",
        severity: db.type === "FOREIGN KEY" ? "warning" : "safe",
        schema,
        table,
        description: `Drop ${db.type} constraint ${quoteIdentifier(name)} from ${q}`,
        sql: `ALTER TABLE ${q} DROP CONSTRAINT ${quoteIdentifier(name)};`,
        autocommit: false,
        constraintType: db.type as SyncOperation["constraintType"],
      });
    }
  }

  // Add constraints that are new or were dropped above (changed)
  for (const [name, desired] of desiredByName) {
    const db = dbByName.get(name);

    if (db && constraintMatches(db, desired)) continue;

    if (desired.type === "PRIMARY KEY") {
      const cols = desired.columns.map((c) => quoteIdentifier(c)).join(", ");
      ops.push({
        type: "add_constraint",
        severity: "safe",
        schema,
        table,
        description: `Add PRIMARY KEY ${quoteIdentifier(name)} on ${q}`,
        sql: `ALTER TABLE ${q} ADD CONSTRAINT ${quoteIdentifier(name)} PRIMARY KEY (${cols});`,
        autocommit: false,
        constraintType: "PRIMARY KEY",
      });
    } else if (desired.type === "UNIQUE") {
      const cols = desired.columns.map((c) => quoteIdentifier(c)).join(", ");
      ops.push({
        type: "add_constraint",
        severity: "safe",
        schema,
        table,
        description: `Add UNIQUE ${quoteIdentifier(name)} on ${q}`,
        sql: `ALTER TABLE ${q} ADD CONSTRAINT ${quoteIdentifier(name)} UNIQUE (${cols});`,
        autocommit: false,
        constraintType: "UNIQUE",
      });
    } else if (desired.type === "CHECK") {
      ops.push({
        type: "add_constraint",
        severity: "safe",
        schema,
        table,
        description: `Add CHECK ${quoteIdentifier(name)} on ${q}`,
        sql: `ALTER TABLE ${q} ADD CONSTRAINT ${quoteIdentifier(name)} ${desired.checkExpr};`,
        autocommit: false,
        constraintType: "CHECK",
      });
    } else if (desired.type === "FOREIGN KEY") {
      const cols = desired.columns.map((c) => quoteIdentifier(c)).join(", ");
      const refTable = desired.foreignSchema
        ? quoteQualifiedName(desired.foreignSchema, desired.foreignTable!)
        : quoteIdentifier(desired.foreignTable!);
      const refCols = (desired.foreignColumns ?? [])
        .map((c) => quoteIdentifier(c))
        .join(", ");
      const onDelete = desired.onDelete ? ` ON DELETE ${desired.onDelete}` : "";
      const onUpdate = desired.onUpdate ? ` ON UPDATE ${desired.onUpdate}` : "";
      const deferrable = desired.deferrable
        ? desired.initiallyDeferred
          ? " DEFERRABLE INITIALLY DEFERRED"
          : " DEFERRABLE INITIALLY IMMEDIATE"
        : "";

      ops.push({
        type: "add_constraint",
        severity: "safe",
        schema,
        table,
        description: `Add FOREIGN KEY ${quoteIdentifier(name)} on ${q}`,
        sql: `ALTER TABLE ${q} ADD CONSTRAINT ${quoteIdentifier(name)} FOREIGN KEY (${cols}) REFERENCES ${refTable} (${refCols})${onDelete}${onUpdate}${deferrable};`,
        autocommit: false,
        constraintType: "FOREIGN KEY",
      });
    }
  }

  return ops;
};
