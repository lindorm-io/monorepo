import type { DesiredTableModel } from "./desired-schema-model.js";
import type { SyncDialect } from "./sync-dialect.js";

/**
 * Duplicate-table check for join/collection tables (both M2M sides project the
 * same join table). Drift (kept): pg dedupes by (namespace, name) — with null
 * collapsing to "public", mirroring the historical `t.schema === (ns ?? "public")`
 * comparison — while mysql/sqlite dedupe by name only.
 */
export const hasProjectedTable = (
  tables: Array<DesiredTableModel>,
  name: string,
  namespace: string | null,
  dialect: SyncDialect,
): boolean =>
  dialect.supportsNamespaces
    ? tables.some(
        (t) => t.name === name && (t.namespace ?? "public") === (namespace ?? "public"),
      )
    : tables.some((t) => t.name === name);
