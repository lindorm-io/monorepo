import { SyncError } from "../../../errors/SyncError.js";
import type { DesiredTableModel } from "./desired-schema-model.js";
import type { SyncDialect } from "./sync-dialect.js";

/**
 * Duplicate-table check for join/collection tables (both M2M sides project the
 * same join table).
 *
 * - Namespace dialects (pg): dedupe by (namespace, name) — null collapses to
 *   "public". Two same-named tables in different namespaces are distinct schema
 *   objects, so both are kept.
 * - Namespace-less dialects (mysql/sqlite): the schema has no namespaces to keep
 *   them apart, so the same physical name IS the same table. A same-namespace
 *   match is the legitimate both-M2M-sides dedupe — skip it. But a same name from
 *   a DIFFERENT source namespace is a genuine collision the dialect cannot
 *   represent (pg would keep them as distinct `schema.name` tables); silently
 *   dropping the second leaves a write pointed at the first table's schema, so
 *   throw instead.
 */
export const hasProjectedTable = (
  tables: Array<DesiredTableModel>,
  name: string,
  namespace: string | null,
  dialect: SyncDialect,
): boolean => {
  if (dialect.supportsNamespaces) {
    return tables.some(
      (t) => t.name === name && (t.namespace ?? "public") === (namespace ?? "public"),
    );
  }

  const existing = tables.find((t) => t.name === name);
  if (!existing) return false;

  if ((existing.namespace ?? null) !== (namespace ?? null)) {
    throw new SyncError(
      `Table name "${name}" collides across namespaces on a namespace-less driver`,
      {
        code: "table_name_collision",
        title: "Table Name Collision",
        details: `Two tables project to the same physical name "${name}" from different namespaces ("${existing.namespace ?? "none"}" and "${namespace ?? "none"}"). This driver has no schemas to keep them apart — give the tables distinct names, or run on a namespace-supporting driver.`,
      },
    );
  }

  return true;
};
