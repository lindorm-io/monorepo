import type { SqliteQueryClient } from "../../types/sqlite-query-client";
import type { SqliteDbSnapshot } from "../../types/db-snapshot";
import { introspectTable } from "./introspect-tables";
import { introspectIndexes } from "./introspect-indexes";

/**
 * Introspects the SQLite database schema by listing all user tables from
 * `sqlite_master`, then introspecting each table's columns, FKs, and indexes.
 *
 * @param client - The SQLite query client.
 * @param managedTableNames - If provided, only introspect these table names.
 *   If empty or not provided, introspects all user tables.
 * @returns A `SqliteDbSnapshot` mapping table names to their introspected state.
 */
export const introspectSchema = (
  client: SqliteQueryClient,
  managedTableNames?: Array<string>,
): SqliteDbSnapshot => {
  const tables = new Map<string, ReturnType<typeof introspectTable>>();

  // List all user tables from sqlite_master
  const masterRows = client.all(
    `SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  );

  const managedSet = managedTableNames ? new Set(managedTableNames) : null;

  for (const row of masterRows) {
    const tableName = row.name as string;
    const tableSql = row.sql as string;

    // If we have a managed set, skip tables not in it
    if (managedSet && !managedSet.has(tableName)) continue;

    const table = introspectTable(client, tableName, tableSql);

    // Introspect indexes separately
    table.indexes = introspectIndexes(client, tableName);

    tables.set(tableName, table);
  }

  return { tables };
};
