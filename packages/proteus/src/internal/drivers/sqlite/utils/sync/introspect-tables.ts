import type { SqliteQueryClient } from "../../types/sqlite-query-client.js";
import type {
  SqliteSnapshotColumn,
  SqliteSnapshotForeignKey,
  SqliteSnapshotTable,
} from "../../types/db-snapshot.js";

/**
 * Introspects a single SQLite table using PRAGMA queries.
 * Returns typed column, FK, and base table info. Indexes are introspected separately.
 *
 * Uses `PRAGMA table_xinfo` (not `table_info`) so STORED/VIRTUAL generated columns
 * — which `table_info` omits entirely — are visible; their expression is recovered
 * from the `sqlite_master` DDL. FK deferrability, which `foreign_key_list` does not
 * expose, is likewise parsed from the DDL so a deferrable FK round-trips.
 */
export const introspectTable = (
  client: SqliteQueryClient,
  tableName: string,
  tableSql: string,
): SqliteSnapshotTable => {
  // PRAGMA table_xinfo returns: cid, name, type, notnull, dflt_value, pk, hidden.
  // hidden: 0 = normal, 1 = truly hidden (skip), 2 = VIRTUAL generated, 3 = STORED generated.
  const columnRows = client.all(
    `PRAGMA table_xinfo(${quoteTableNameForPragma(tableName)})`,
  );

  const columns: Array<SqliteSnapshotColumn> = [];
  for (const row of columnRows) {
    const hidden = row.hidden as number;
    if (hidden === 1) continue; // internal/hidden column, never proteus-managed

    const isGenerated = hidden === 2 || hidden === 3;
    columns.push({
      cid: row.cid as number,
      name: row.name as string,
      type: row.type as string,
      notNull: (row.notnull as number) === 1,
      defaultValue: row.dflt_value as string | null,
      pk: row.pk as number,
      generatedExpr: isGenerated
        ? parseGeneratedExpression(tableSql, row.name as string)
        : null,
    });
  }

  // PRAGMA foreign_key_list returns: id, seq, table, from, to, on_update, on_delete, match
  const fkRows = client.all(
    `PRAGMA foreign_key_list(${quoteTableNameForPragma(tableName)})`,
  );

  const deferrableByColumns = parseDeferrableForeignKeys(tableSql);

  // Group rows by FK id to recover the (ordered) from-column list, then look up
  // deferrability from the DDL — `foreign_key_list` does not report it.
  const fromColumnsById = new Map<number, Array<string>>();
  for (const row of fkRows) {
    const id = row.id as number;
    if (!fromColumnsById.has(id)) fromColumnsById.set(id, []);
    fromColumnsById.get(id)!.push(row.from as string);
  }

  const deferrableById = new Map<
    number,
    { deferrable: boolean; initiallyDeferred: boolean }
  >();
  for (const [id, fromCols] of fromColumnsById) {
    deferrableById.set(
      id,
      deferrableByColumns.get(fromCols.join(",")) ?? EMPTY_DEFERRABLE,
    );
  }

  const foreignKeys: Array<SqliteSnapshotForeignKey> = fkRows.map((row) => {
    const clause = deferrableById.get(row.id as number) ?? EMPTY_DEFERRABLE;
    return {
      id: row.id as number,
      seq: row.seq as number,
      table: row.table as string,
      from: row.from as string,
      to: row.to as string,
      onUpdate: row.on_update as string,
      onDelete: row.on_delete as string,
      deferrable: clause.deferrable,
      initiallyDeferred: clause.initiallyDeferred,
    };
  });

  return {
    name: tableName,
    columns,
    foreignKeys,
    indexes: [], // populated by introspect-indexes
    triggers: [], // populated by introspect-schema
    sql: tableSql,
  };
};

const EMPTY_DEFERRABLE = { deferrable: false, initiallyDeferred: false };

/**
 * Extracts the balanced-paren generation expression for a generated column from
 * a `CREATE TABLE` DDL — the text between `AS (` and its matching `)`.
 */
const parseGeneratedExpression = (ddl: string, columnName: string): string | null => {
  const quoted = `"${columnName.replace(/"/g, '""')}"`;
  const start = ddl.indexOf(quoted);
  if (start === -1) return null;

  const rest = ddl.slice(start + quoted.length);
  const match = /\bAS\s*\(/i.exec(rest);
  if (!match) return null;

  let depth = 1;
  let expr = "";
  for (let i = match.index + match[0].length; i < rest.length && depth > 0; i++) {
    const char = rest[i];
    if (char === "(") depth++;
    else if (char === ")") {
      depth--;
      if (depth === 0) break;
    }
    expr += char;
  }

  return depth === 0 ? expr.trim() : null;
};

/**
 * Parses inline `FOREIGN KEY (...) REFERENCES ... [DEFERRABLE [INITIALLY DEFERRED]]`
 * clauses from a `CREATE TABLE` DDL, keyed by the comma-joined from-column list, so
 * deferrability (which `PRAGMA foreign_key_list` omits) can be attached to each FK.
 */
const parseDeferrableForeignKeys = (
  ddl: string,
): Map<string, { deferrable: boolean; initiallyDeferred: boolean }> => {
  const result = new Map<string, { deferrable: boolean; initiallyDeferred: boolean }>();
  const regex =
    /FOREIGN\s+KEY\s*\(([^)]*)\)\s*REFERENCES[\s\S]*?(?=,\s*(?:FOREIGN\s+KEY|CONSTRAINT|PRIMARY\s+KEY|UNIQUE|CHECK)\b|\)\s*;?\s*$)/gi;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(ddl)) !== null) {
    const fromCols = match[1]
      .split(",")
      .map((c) => c.trim().replace(/^"|"$/g, "").replace(/""/g, '"'))
      .join(",");
    const clause = match[0];
    const deferrable =
      /\bDEFERRABLE\b/i.test(clause) && !/\bNOT\s+DEFERRABLE\b/i.test(clause);
    const initiallyDeferred = /\bINITIALLY\s+DEFERRED\b/i.test(clause);
    result.set(fromCols, { deferrable, initiallyDeferred });
  }

  return result;
};

/**
 * Quotes a table name for PRAGMA arguments.
 * PRAGMA table_xinfo accepts both quoted and unquoted names;
 * we use double quotes for safety with special characters.
 */
const quoteTableNameForPragma = (name: string): string => `"${name.replace(/"/g, '""')}"`;
