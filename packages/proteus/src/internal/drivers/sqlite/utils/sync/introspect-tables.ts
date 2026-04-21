import type { SqliteQueryClient } from "../../types/sqlite-query-client.js";
import type {
  SqliteSnapshotColumn,
  SqliteSnapshotForeignKey,
  SqliteSnapshotTable,
} from "../../types/db-snapshot.js";

/**
 * Introspects a single SQLite table using PRAGMA queries.
 * Returns typed column, FK, and base table info. Indexes are introspected separately.
 */
export const introspectTable = (
  client: SqliteQueryClient,
  tableName: string,
  tableSql: string,
): SqliteSnapshotTable => {
  // PRAGMA table_info returns: cid, name, type, notnull, dflt_value, pk
  const columnRows = client.all(
    `PRAGMA table_info(${quoteTableNameForPragma(tableName)})`,
  );

  const columns: Array<SqliteSnapshotColumn> = columnRows.map((row) => ({
    cid: row.cid as number,
    name: row.name as string,
    type: row.type as string,
    notNull: (row.notnull as number) === 1,
    defaultValue: row.dflt_value as string | null,
    pk: row.pk as number,
  }));

  // PRAGMA foreign_key_list returns: id, seq, table, from, to, on_update, on_delete, match
  const fkRows = client.all(
    `PRAGMA foreign_key_list(${quoteTableNameForPragma(tableName)})`,
  );

  const foreignKeys: Array<SqliteSnapshotForeignKey> = fkRows.map((row) => ({
    id: row.id as number,
    seq: row.seq as number,
    table: row.table as string,
    from: row.from as string,
    to: row.to as string,
    onUpdate: row.on_update as string,
    onDelete: row.on_delete as string,
  }));

  return {
    name: tableName,
    columns,
    foreignKeys,
    indexes: [], // populated by introspect-indexes
    triggers: [], // populated by introspect-schema
    sql: tableSql,
  };
};

/**
 * Quotes a table name for PRAGMA arguments.
 * PRAGMA table_info accepts both quoted and unquoted names;
 * we use double quotes for safety with special characters.
 */
const quoteTableNameForPragma = (name: string): string => `"${name.replace(/"/g, '""')}"`;
