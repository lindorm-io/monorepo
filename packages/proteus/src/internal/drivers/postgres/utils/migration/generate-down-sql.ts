import type { DbConstraint, DbIndex, DbSnapshot, DbTable } from "../../types/db-snapshot";
import type { SyncOperation } from "../../types/sync-plan";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";

// Extracts the first double-quoted identifier from a description string.
// Contract: all diff-*.ts description templates place the target identifier
// (column, constraint, or index name) as the first quoted token, before
// the schema-qualified table reference.
const extractName = (description: string): string | null => {
  const match = description.match(/"([^"]+)"/);
  return match ? match[1] : null;
};

const findTable = (
  snapshot: DbSnapshot,
  schema: string | null,
  table: string | null,
): DbTable | null =>
  schema && table
    ? (snapshot.tables.find((t) => t.schema === schema && t.name === table) ?? null)
    : null;

const reconstructAddConstraintSql = (
  schema: string,
  table: string,
  c: DbConstraint,
): string | null => {
  const q = quoteQualifiedName(schema, table);
  const cols = c.columns.map((n) => quoteIdentifier(n)).join(", ");

  switch (c.type) {
    case "PRIMARY KEY":
      return `ALTER TABLE ${q} ADD CONSTRAINT ${quoteIdentifier(c.name)} PRIMARY KEY (${cols});`;

    case "UNIQUE":
      return `ALTER TABLE ${q} ADD CONSTRAINT ${quoteIdentifier(c.name)} UNIQUE (${cols});`;

    case "CHECK":
      if (!c.checkExpr) return null;
      return `ALTER TABLE ${q} ADD CONSTRAINT ${quoteIdentifier(c.name)} ${c.checkExpr};`;

    case "FOREIGN KEY": {
      const refTable = c.foreignSchema
        ? quoteQualifiedName(c.foreignSchema, c.foreignTable!)
        : quoteIdentifier(c.foreignTable!);
      const refCols = (c.foreignColumns ?? []).map((n) => quoteIdentifier(n)).join(", ");
      const onDelete = c.onDelete ? ` ON DELETE ${c.onDelete}` : "";
      const onUpdate = c.onUpdate ? ` ON UPDATE ${c.onUpdate}` : "";
      const deferrable = c.deferrable
        ? c.initiallyDeferred
          ? " DEFERRABLE INITIALLY DEFERRED"
          : " DEFERRABLE INITIALLY IMMEDIATE"
        : "";
      return `ALTER TABLE ${q} ADD CONSTRAINT ${quoteIdentifier(c.name)} FOREIGN KEY (${cols}) REFERENCES ${refTable} (${refCols})${onDelete}${onUpdate}${deferrable};`;
    }

    default:
      return null;
  }
};

// CONCURRENTLY is intentionally omitted — DbIndex does not store whether
// the original index was created with CONCURRENTLY, and CREATE INDEX
// CONCURRENTLY cannot run inside a transaction (which migration down()
// methods typically use).
const reconstructCreateIndexSql = (
  schema: string,
  table: string,
  idx: DbIndex,
): string => {
  const q = quoteQualifiedName(schema, table);
  const unique = idx.unique ? "UNIQUE " : "";
  const cols = idx.columns
    .map((c) => `${quoteIdentifier(c.name)} ${c.direction.toUpperCase()}`)
    .join(", ");

  let using = "";
  if (idx.method && idx.method !== "btree") {
    using = ` USING ${idx.method}`;
  }

  let stmt = `CREATE ${unique}INDEX ${quoteIdentifier(idx.name)} ON ${q}${using} (${cols})`;

  if (idx.include.length > 0) {
    stmt += ` INCLUDE (${idx.include.map((c) => quoteIdentifier(c)).join(", ")})`;
  }

  if (idx.where) {
    stmt += ` WHERE ${idx.where}`;
  }

  return `${stmt};`;
};

// Column vs table dispatch uses the sql field (not description) because
// the SQL reliably contains "COMMENT ON COLUMN" vs "COMMENT ON TABLE",
// and the column name must be extracted from the third quoted segment
// of the three-part "schema"."table"."column" path in the SQL.
const generateDownComment = (
  operation: SyncOperation,
  snapshot: DbSnapshot,
): string | null => {
  const { schema, table, sql } = operation;
  if (!schema || !table) return null;
  const q = quoteQualifiedName(schema, table);
  const dbTable = findTable(snapshot, schema, table);

  if (sql.includes("COMMENT ON COLUMN")) {
    const colMatch = sql.match(/COMMENT ON COLUMN "(?:[^"]+)"\."(?:[^"]+)"\."([^"]+)"/);
    const colName = colMatch ? colMatch[1] : null;
    if (!colName) return null;

    const prior = dbTable?.columnComments[colName] ?? null;
    if (prior) {
      return `COMMENT ON COLUMN ${q}.${quoteIdentifier(colName)} IS '${prior.replace(/'/g, "''")}';`;
    }
    return `COMMENT ON COLUMN ${q}.${quoteIdentifier(colName)} IS NULL;`;
  }

  const prior = dbTable?.comment ?? null;
  if (prior) {
    return `COMMENT ON TABLE ${q} IS '${prior.replace(/'/g, "''")}';`;
  }
  return `COMMENT ON TABLE ${q} IS NULL;`;
};

/**
 * Generates down-migration SQL from a sync plan by reversing each operation.
 * Dispatches on `SyncOperation.type` and, for some types, on the operation description
 * string to distinguish sub-cases (e.g. "Drop temporary default" vs regular default change).
 * Returns `null` for irreversible operations (drop_column, drop_and_readd_column, etc.)
 * which are emitted as `-- WARN: irreversible` comments in the migration file.
 *
 * NOTE: Some dispatch logic depends on description string prefixes from diff-*.ts files.
 * If description templates change, the corresponding cases here must be updated.
 */
export const generateDownSql = (
  operation: SyncOperation,
  snapshot: DbSnapshot,
): string | null => {
  const { type, schema, table, description, sql } = operation;
  const q = schema && table ? quoteQualifiedName(schema, table) : null;

  switch (type) {
    // --- Irreversible ---
    case "create_extension":
    case "create_schema":
    case "create_enum":
    case "add_enum_value":
    case "create_table":
    case "drop_column":
    case "alter_column_type":
    case "alter_column_identity":
    case "backfill_column":
    case "warn_only":
      return null;

    // --- Columns ---
    case "add_column": {
      const col = extractName(description);
      if (!col || !q) return null;
      return `ALTER TABLE ${q} DROP COLUMN ${quoteIdentifier(col)};`;
    }

    case "alter_column_nullable": {
      const col = extractName(description);
      if (!col || !q) return null;
      if (sql.includes("DROP NOT NULL")) {
        return `ALTER TABLE ${q} ALTER COLUMN ${quoteIdentifier(col)} SET NOT NULL;`;
      }
      if (sql.includes("SET NOT NULL")) {
        return `ALTER TABLE ${q} ALTER COLUMN ${quoteIdentifier(col)} DROP NOT NULL;`;
      }
      return null;
    }

    // "Drop temporary" prefix matches the description emitted by
    // diff-columns.ts for synthetic temporary-default cleanup ops.
    case "alter_column_default": {
      if (description.startsWith("Drop temporary")) return null;
      const col = extractName(description);
      if (!col || !q) return null;
      const dbTable = findTable(snapshot, schema, table);
      const prior = dbTable?.columns.find((c) => c.name === col)?.defaultExpr ?? null;
      if (prior) {
        return `ALTER TABLE ${q} ALTER COLUMN ${quoteIdentifier(col)} SET DEFAULT ${prior};`;
      }
      return `ALTER TABLE ${q} ALTER COLUMN ${quoteIdentifier(col)} DROP DEFAULT;`;
    }

    // drop_and_readd_column comes in pairs:
    // - Drop phase (description starts with "Drop"): irreversible, data lost → null
    // - Re-add phase (description starts with "Re-add"): reversal is DROP COLUMN
    // This applies to both computed-column expression changes and
    // incompatible type changes (e.g. TEXT → POINT).
    case "drop_and_readd_column": {
      if (description.startsWith("Re-add")) {
        const col = extractName(description);
        if (!col || !q) return null;
        return `ALTER TABLE ${q} DROP COLUMN ${quoteIdentifier(col)};`;
      }
      return null;
    }

    // --- Constraints ---
    case "add_constraint": {
      const name = extractName(description);
      if (!name || !q) return null;
      return `ALTER TABLE ${q} DROP CONSTRAINT ${quoteIdentifier(name)};`;
    }

    case "drop_constraint": {
      const name = extractName(description);
      if (!name || !schema || !table) return null;
      const dbTable = findTable(snapshot, schema, table);
      const c = dbTable?.constraints.find((con) => con.name === name);
      if (!c) return null;
      return reconstructAddConstraintSql(schema, table, c);
    }

    // --- Indexes ---
    case "create_index": {
      const name = extractName(description);
      if (!name || !schema) return null;
      return `DROP INDEX IF EXISTS ${quoteQualifiedName(schema, name)};`;
    }

    case "drop_index": {
      const name = extractName(description);
      if (!name || !schema || !table) return null;
      const dbTable = findTable(snapshot, schema, table);
      const idx = dbTable?.indexes.find((i) => i.name === name);
      if (!idx) return null;
      return reconstructCreateIndexSql(schema, table, idx);
    }

    // --- Comments ---
    case "set_comment":
      return generateDownComment(operation, snapshot);

    default:
      return null;
  }
};
