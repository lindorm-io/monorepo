import type { DbEnum } from "../../types/db-snapshot";
import type { DesiredEnum } from "../../types/desired-schema";
import type { SyncOperation } from "../../types/sync-plan";
import { quoteQualifiedName } from "../quote-identifier";

/**
 * Diffs existing DB enum types against desired types. Produces `create_enum` ops for new
 * types and `add_enum_value` ops for values missing from existing types. Adding enum values
 * cannot run inside a transaction (PG limitation), so these ops are marked `autocommit: true`.
 */
export const diffEnums = (
  dbEnums: Array<DbEnum>,
  desiredEnums: Array<DesiredEnum>,
): Array<SyncOperation> => {
  const ops: Array<SyncOperation> = [];

  for (const desired of desiredEnums) {
    const existing = dbEnums.find(
      (e) => e.schema === desired.schema && e.name === desired.name,
    );

    if (!existing) {
      // New enum type
      const enumQualified = quoteQualifiedName(desired.schema, desired.name);
      const valueList = desired.values
        .map((v) => `'${v.replace(/'/g, "''")}'`)
        .join(", ");
      ops.push({
        type: "create_enum",
        severity: "safe",
        schema: desired.schema,
        table: null,
        description: `Create enum type ${enumQualified}`,
        sql: `CREATE TYPE ${enumQualified} AS ENUM (${valueList});`,
        autocommit: false,
      });
      continue;
    }

    // Check for new values (PG can only ADD values, never remove)
    const enumQualified = quoteQualifiedName(desired.schema, desired.name);
    for (const value of desired.values) {
      if (!existing.values.includes(value)) {
        ops.push({
          type: "add_enum_value",
          severity: "safe",
          schema: desired.schema,
          table: null,
          description: `Add value '${value}' to enum ${enumQualified}`,
          sql: `ALTER TYPE ${enumQualified} ADD VALUE IF NOT EXISTS '${value.replace(/'/g, "''")}';`,
          autocommit: true,
        });
      }
    }

    // Warn about stale values (exist in DB but not in desired)
    for (const value of existing.values) {
      if (!desired.values.includes(value)) {
        ops.push({
          type: "warn_only",
          severity: "warning",
          schema: desired.schema,
          table: null,
          description: `Stale enum value '${value}' in ${enumQualified} — cannot be removed by PG`,
          sql: `-- STALE ENUM VALUE: '${value}' in ${enumQualified} (cannot remove)`,
          autocommit: false,
        });
      }
    }
  }

  return ops;
};
