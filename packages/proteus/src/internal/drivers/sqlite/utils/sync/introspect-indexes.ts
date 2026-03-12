import type { SqliteQueryClient } from "../../types/sqlite-query-client";
import type {
  SqliteSnapshotIndex,
  SqliteSnapshotIndexColumn,
} from "../../types/db-snapshot";

/**
 * Introspects all indexes for a given table using PRAGMA queries.
 *
 * Uses `PRAGMA index_list(tableName)` to get index metadata, then
 * `PRAGMA index_info(indexName)` to get each index's column composition.
 *
 * Skips auto-generated indexes for PRIMARY KEY and UNIQUE constraints
 * with origin "pk" — those are implicit and not managed by the ORM's index DDL.
 */
export const introspectIndexes = (
  client: SqliteQueryClient,
  tableName: string,
): Array<SqliteSnapshotIndex> => {
  const indexListRows = client.all(
    `PRAGMA index_list("${tableName.replace(/"/g, '""')}")`,
  );

  const indexes: Array<SqliteSnapshotIndex> = [];

  for (const row of indexListRows) {
    const indexName = row.name as string;
    const unique = (row.unique as number) === 1;
    const origin = row.origin as string; // "c" = CREATE INDEX, "u" = UNIQUE constraint, "pk" = PK
    const partial = (row.partial as number) === 1;

    // Skip PK indexes — they are implicit
    if (origin === "pk") continue;

    // Get index columns
    const colRows = client.all(`PRAGMA index_info("${indexName.replace(/"/g, '""')}")`);

    const columns: Array<SqliteSnapshotIndexColumn> = colRows.map((colRow) => ({
      seqno: colRow.seqno as number,
      cid: colRow.cid as number,
      name: colRow.name as string,
    }));

    indexes.push({
      name: indexName,
      unique,
      origin,
      partial,
      columns,
    });
  }

  return indexes;
};
