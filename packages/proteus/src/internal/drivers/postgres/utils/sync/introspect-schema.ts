import { uniq } from "@lindorm/utils";
import { introspectComments } from "../../../../drivers/postgres/utils/sync/introspect-comments.js";
import { introspectConstraints } from "../../../../drivers/postgres/utils/sync/introspect-constraints.js";
import { introspectEnums } from "../../../../drivers/postgres/utils/sync/introspect-enums.js";
import { introspectIndexes } from "../../../../drivers/postgres/utils/sync/introspect-indexes.js";
import { introspectTriggers } from "../../../../drivers/postgres/utils/sync/introspect-triggers.js";
import type { DbSnapshot, DbTable } from "../../types/db-snapshot.js";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";
import { introspectTables } from "./introspect-tables.js";

type ManagedTable = {
  schema: string;
  name: string;
};

export const introspectSchema = async (
  client: PostgresQueryClient,
  managedTables: Array<ManagedTable>,
): Promise<DbSnapshot> => {
  if (managedTables.length === 0) {
    return { tables: [], enums: [], schemas: [] };
  }

  // Build a set of (schema, name) pairs for post-filtering
  // The queries use separate schema/table arrays which creates a cross-product,
  // so we filter results to only include actually managed tables
  const managedSet = new Set(managedTables.map((t) => `${t.schema}.${t.name}`));

  const schemas = uniq(managedTables.map((t) => t.schema));
  const tableNames = uniq(managedTables.map((t) => t.name));

  const [tables, constraintRows, indexRows, enums, commentRows, triggerRows, schemaRows] =
    await Promise.all([
      introspectTables(client, schemas, tableNames),
      introspectConstraints(client, schemas, tableNames),
      introspectIndexes(client, schemas, tableNames),
      introspectEnums(client, schemas),
      introspectComments(client, schemas, tableNames),
      introspectTriggers(client, schemas, tableNames),
      client.query<{ nspname: string }>(
        `SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname = ANY($1)`,
        [schemas],
      ),
    ]);

  const tableMap = new Map<string, DbTable>();
  for (const table of tables) {
    const key = `${table.schema}.${table.name}`;
    // Post-filter: only include tables that are actually managed
    if (!managedSet.has(key)) continue;
    tableMap.set(key, table);
  }

  for (const { schema, table, constraint } of constraintRows) {
    const key = `${schema}.${table}`;
    const t = tableMap.get(key);
    if (t) {
      t.constraints.push(constraint);
    }
  }

  for (const { schema, table, index } of indexRows) {
    const key = `${schema}.${table}`;
    const t = tableMap.get(key);
    if (t) {
      t.indexes.push(index);
    }
  }

  for (const row of commentRows) {
    const key = `${row.schema}.${row.table}`;
    const t = tableMap.get(key);
    if (!t) continue;

    if (row.column === null) {
      t.comment = row.comment;
    } else {
      t.columnComments[row.column] = row.comment;
    }
  }

  for (const row of triggerRows) {
    const key = `${row.schema}.${row.table}`;
    const t = tableMap.get(key);
    if (t) {
      t.triggers.push({ name: row.triggerName });
    }
  }

  return {
    tables: Array.from(tableMap.values()),
    enums,
    schemas: schemaRows.rows.map((r) => r.nspname),
  };
};
