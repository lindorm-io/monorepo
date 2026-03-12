import type { DbTable } from "../../types/db-snapshot";
import type { DesiredTable } from "../../types/desired-schema";
import type { SyncOperation } from "../../types/sync-plan";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";

/**
 * Diffs table and column comments between the DB snapshot and desired schema.
 * Produces `set_comment` ops for new/changed comments and removes orphan comments.
 */
export const diffComments = (
  dbTable: DbTable,
  desiredTable: DesiredTable,
): Array<SyncOperation> => {
  const ops: Array<SyncOperation> = [];
  const schema = desiredTable.schema;
  const table = desiredTable.name;
  const q = quoteQualifiedName(schema, table);

  // Table comment
  if (desiredTable.comment !== dbTable.comment) {
    if (desiredTable.comment) {
      const escaped = desiredTable.comment.replace(/'/g, "''");
      ops.push({
        type: "set_comment",
        severity: "safe",
        schema,
        table,
        description: `Set comment on table ${q}`,
        sql: `COMMENT ON TABLE ${q} IS '${escaped}';`,
        autocommit: false,
      });
    } else {
      ops.push({
        type: "set_comment",
        severity: "safe",
        schema,
        table,
        description: `Remove comment from table ${q}`,
        sql: `COMMENT ON TABLE ${q} IS NULL;`,
        autocommit: false,
      });
    }
  }

  // Column comments
  const allCols = new Set([
    ...Object.keys(desiredTable.columnComments),
    ...Object.keys(dbTable.columnComments),
  ]);

  for (const col of allCols) {
    const desired = desiredTable.columnComments[col] ?? null;
    const current = dbTable.columnComments[col] ?? null;

    if (desired === current) continue;

    if (desired) {
      const escaped = desired.replace(/'/g, "''");
      ops.push({
        type: "set_comment",
        severity: "safe",
        schema,
        table,
        description: `Set comment on column ${q}.${quoteIdentifier(col)}`,
        sql: `COMMENT ON COLUMN ${q}.${quoteIdentifier(col)} IS '${escaped}';`,
        autocommit: false,
      });
    } else {
      ops.push({
        type: "set_comment",
        severity: "safe",
        schema,
        table,
        description: `Remove comment from column ${q}.${quoteIdentifier(col)}`,
        sql: `COMMENT ON COLUMN ${q}.${quoteIdentifier(col)} IS NULL;`,
        autocommit: false,
      });
    }
  }

  return ops;
};
