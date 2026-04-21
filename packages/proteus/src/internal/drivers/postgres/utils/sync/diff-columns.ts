import { classifyTypeCast } from "../../../../drivers/postgres/utils/sync/classify-type-cast.js";
import type { DbColumn } from "../../types/db-snapshot.js";
import type { DesiredColumn } from "../../types/desired-schema.js";
import type { SyncOperation } from "../../types/sync-plan.js";
import { PostgresSyncError } from "../../errors/PostgresSyncError.js";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier.js";
import { normalizeDefaultExpressions } from "./normalize-default-expressions.js";
import { normalizePgType } from "./normalize-pg-type.js";

// Zero-value defaults for NOT NULL backfill when going nullable → not null
const ZERO_VALUES: Record<string, string> = {
  BOOLEAN: "false",
  SMALLINT: "0",
  INTEGER: "0",
  BIGINT: "0",
  REAL: "0",
  "DOUBLE PRECISION": "0",
  NUMERIC: "0",
  TEXT: "''",
  UUID: "'00000000-0000-0000-0000-000000000000'",
  JSONB: "'{}'",
  JSON: "'{}'",
  BYTEA: "'\\x'",
  DATE: "'1970-01-01'",
  TIME: "'00:00:00'",
  INTERVAL: "'0'",
  INET: "'0.0.0.0'",
  CIDR: "'0.0.0.0/0'",
  MACADDR: "'00:00:00:00:00:00'",
  XML: "'<x/>'",
  POINT: "'(0,0)'",
};

const getZeroValue = (pgType: string): string => {
  // Strip params for lookup
  const base = pgType.replace(/\(.*\)/, "").trim();
  if (base.startsWith("TIMESTAMPTZ") || base.startsWith("TIMESTAMP"))
    return "'1970-01-01T00:00:00Z'";
  if (base.startsWith("VARCHAR")) return "''";
  if (base.startsWith("VECTOR")) return "NULL";
  return ZERO_VALUES[base] ?? "NULL";
};

/**
 * Diffs existing DB columns against desired columns. Produces operations for adding,
 * dropping, and altering columns (type, nullability, default, identity). Type changes
 * are classified via `classifyTypeCast` to determine safe vs destructive migrations.
 * When making a column NOT NULL, a backfill step is emitted first using a zero-value default.
 */
export const diffColumns = (
  dbColumns: Array<DbColumn>,
  desiredColumns: Array<DesiredColumn>,
  schema: string,
  table: string,
): Array<SyncOperation> => {
  const ops: Array<SyncOperation> = [];
  const q = quoteQualifiedName(schema, table);

  const dbMap = new Map(dbColumns.map((c) => [c.name, c]));
  const desiredMap = new Map(desiredColumns.map((c) => [c.name, c]));

  // Add new columns
  for (const desired of desiredColumns) {
    if (dbMap.has(desired.name)) continue;

    let colDef = `${quoteIdentifier(desired.name)} ${desired.pgType}`;

    if (desired.isGenerated && desired.generationExpr) {
      colDef += ` GENERATED ALWAYS AS (${desired.generationExpr}) STORED`;
    } else if (desired.isIdentity) {
      colDef += ` GENERATED ${desired.identityGeneration ?? "ALWAYS"} AS IDENTITY`;
    } else {
      if (desired.collation) colDef += ` COLLATE ${quoteIdentifier(desired.collation)}`;

      // For NOT NULL columns, always include a default to handle existing rows
      if (!desired.nullable) {
        const defVal = desired.defaultExpr ?? getZeroValue(desired.pgType);
        if (defVal === "NULL" && !desired.defaultExpr) {
          throw new PostgresSyncError(
            `Cannot add NOT NULL column ${quoteIdentifier(desired.name)} on ${q}: ` +
              `type ${desired.pgType} has no zero value — provide an explicit default`,
          );
        }
        colDef += ` NOT NULL DEFAULT ${defVal}`;
      } else if (desired.defaultExpr) {
        colDef += ` DEFAULT ${desired.defaultExpr}`;
      }
    }

    ops.push({
      type: "add_column",
      severity: "safe",
      schema,
      table,
      description: `Add column ${quoteIdentifier(desired.name)} to ${q}`,
      sql: `ALTER TABLE ${q} ADD COLUMN ${colDef};`,
      autocommit: false,
    });

    // If we set a temporary default for NOT NULL, remove it after if entity has no default
    if (
      !desired.nullable &&
      !desired.isGenerated &&
      !desired.isIdentity &&
      !desired.defaultExpr
    ) {
      ops.push({
        type: "alter_column_default",
        severity: "safe",
        schema,
        table,
        description: `Drop temporary default from ${quoteIdentifier(desired.name)} on ${q}`,
        sql: `ALTER TABLE ${q} ALTER COLUMN ${quoteIdentifier(desired.name)} DROP DEFAULT;`,
        autocommit: false,
      });
    }
  }

  // Drop removed columns
  for (const db of dbColumns) {
    if (desiredMap.has(db.name)) continue;

    ops.push({
      type: "drop_column",
      severity: "destructive",
      schema,
      table,
      description: `Drop column ${quoteIdentifier(db.name)} from ${q}`,
      sql: `ALTER TABLE ${q} DROP COLUMN ${quoteIdentifier(db.name)};`,
      autocommit: false,
    });
  }

  // Alter existing columns
  for (const desired of desiredColumns) {
    const db = dbMap.get(desired.name);
    if (!db) continue;

    const normalizedDbType = normalizePgType(db.type);
    const normalizedDesiredType = normalizePgType(desired.pgType);

    // Track whether the column was fully replaced (drop+readd handles nullable/default inline)
    let columnReplaced = false;

    // Type change
    if (normalizedDbType !== normalizedDesiredType) {
      // Computed column expression change → drop + readd
      if (desired.isGenerated) {
        const notNull = !desired.nullable ? " NOT NULL" : "";
        ops.push({
          type: "drop_and_readd_column",
          severity: "destructive",
          schema,
          table,
          description: `Drop computed column ${quoteIdentifier(desired.name)} on ${q} (type/expression changed)`,
          sql: `ALTER TABLE ${q} DROP COLUMN ${quoteIdentifier(desired.name)};`,
          autocommit: false,
        });
        ops.push({
          type: "drop_and_readd_column",
          severity: "destructive",
          schema,
          table,
          description: `Re-add computed column ${quoteIdentifier(desired.name)} on ${q}`,
          sql: `ALTER TABLE ${q} ADD COLUMN ${quoteIdentifier(desired.name)} ${desired.pgType}${notNull} GENERATED ALWAYS AS (${desired.generationExpr}) STORED;`,
          autocommit: false,
        });
        continue;
      }

      const cast = classifyTypeCast(normalizedDbType, normalizedDesiredType);

      // When the DB column has an existing default, drop it first in the same
      // ALTER TABLE statement — PG cannot auto-cast defaults to the new type.
      const dropDefaultPrefix =
        db.defaultExpr != null
          ? `ALTER TABLE ${q} ALTER COLUMN ${quoteIdentifier(desired.name)} DROP DEFAULT; `
          : "";

      const collateClause = desired.collation
        ? ` COLLATE ${quoteIdentifier(desired.collation)}`
        : "";

      switch (cast.action) {
        case "alter":
          ops.push({
            type: "alter_column_type",
            severity: "warning",
            schema,
            table,
            description: `Change type of ${quoteIdentifier(desired.name)} on ${q}: ${normalizedDbType} → ${normalizedDesiredType}`,
            sql: `${dropDefaultPrefix}ALTER TABLE ${q} ALTER COLUMN ${quoteIdentifier(desired.name)} TYPE ${desired.pgType}${collateClause};`,
            autocommit: false,
          });
          break;

        case "alter_using": {
          const usingClause = cast.using.replace(
            /\bcol\b/g,
            quoteIdentifier(desired.name),
          );
          ops.push({
            type: "alter_column_type",
            severity: "warning",
            schema,
            table,
            description: `Change type of ${quoteIdentifier(desired.name)} on ${q}: ${normalizedDbType} → ${normalizedDesiredType} (USING)`,
            sql: `${dropDefaultPrefix}ALTER TABLE ${q} ALTER COLUMN ${quoteIdentifier(desired.name)} TYPE ${desired.pgType}${collateClause} USING ${usingClause};`,
            autocommit: false,
          });
          break;
        }

        case "drop_readd": {
          let addDef = `${quoteIdentifier(desired.name)} ${desired.pgType}`;
          if (desired.collation)
            addDef += ` COLLATE ${quoteIdentifier(desired.collation)}`;
          if (!desired.nullable) {
            const defVal = desired.defaultExpr ?? getZeroValue(desired.pgType);
            if (defVal === "NULL" && !desired.defaultExpr) {
              throw new PostgresSyncError(
                `Cannot re-add NOT NULL column ${quoteIdentifier(desired.name)} on ${q}: ` +
                  `type ${desired.pgType} has no zero value — provide an explicit default`,
              );
            }
            addDef += ` NOT NULL DEFAULT ${defVal}`;
          }
          ops.push({
            type: "drop_and_readd_column",
            severity: "destructive",
            schema,
            table,
            description: `Drop ${quoteIdentifier(desired.name)} on ${q}: ${normalizedDbType} → ${normalizedDesiredType} (incompatible)`,
            sql: `ALTER TABLE ${q} DROP COLUMN ${quoteIdentifier(desired.name)};`,
            autocommit: false,
          });
          ops.push({
            type: "drop_and_readd_column",
            severity: "destructive",
            schema,
            table,
            description: `Re-add ${quoteIdentifier(desired.name)} on ${q}: ${normalizedDesiredType}`,
            sql: `ALTER TABLE ${q} ADD COLUMN ${addDef};`,
            autocommit: false,
          });

          // Drop temporary default after re-add if NOT NULL was added without explicit default
          if (!desired.nullable && !desired.defaultExpr) {
            ops.push({
              type: "alter_column_default",
              severity: "safe",
              schema,
              table,
              description: `Drop temporary default from ${quoteIdentifier(desired.name)} on ${q}`,
              sql: `ALTER TABLE ${q} ALTER COLUMN ${quoteIdentifier(desired.name)} DROP DEFAULT;`,
              autocommit: false,
            });
          }

          columnReplaced = true;
          break;
        }
      }
    }

    // Identity change
    if (desired.isIdentity !== db.isIdentity) {
      if (desired.isIdentity) {
        ops.push({
          type: "alter_column_identity",
          severity: "warning",
          schema,
          table,
          description: `Add identity to ${quoteIdentifier(desired.name)} on ${q}`,
          sql: `ALTER TABLE ${q} ALTER COLUMN ${quoteIdentifier(desired.name)} ADD GENERATED ${desired.identityGeneration ?? "ALWAYS"} AS IDENTITY;`,
          autocommit: false,
        });
      } else {
        ops.push({
          type: "alter_column_identity",
          severity: "warning",
          schema,
          table,
          description: `Drop identity from ${quoteIdentifier(desired.name)} on ${q}`,
          sql: `ALTER TABLE ${q} ALTER COLUMN ${quoteIdentifier(desired.name)} DROP IDENTITY IF EXISTS;`,
          autocommit: false,
        });
      }
    } else if (
      desired.isIdentity &&
      desired.identityGeneration !== db.identityGeneration
    ) {
      ops.push({
        type: "alter_column_identity",
        severity: "warning",
        schema,
        table,
        description: `Change identity generation of ${quoteIdentifier(desired.name)} on ${q}`,
        sql: `ALTER TABLE ${q} ALTER COLUMN ${quoteIdentifier(desired.name)} SET GENERATED ${desired.identityGeneration ?? "ALWAYS"};`,
        autocommit: false,
      });
    }

    // Nullable change — skip if column was fully replaced (drop_readd handles nullable inline)
    if (!columnReplaced && desired.nullable !== db.nullable) {
      if (desired.nullable) {
        // NOT NULL → nullable (safe)
        ops.push({
          type: "alter_column_nullable",
          severity: "safe",
          schema,
          table,
          description: `Allow NULL on ${quoteIdentifier(desired.name)} on ${q}`,
          sql: `ALTER TABLE ${q} ALTER COLUMN ${quoteIdentifier(desired.name)} DROP NOT NULL;`,
          autocommit: false,
        });
      } else {
        // nullable → NOT NULL (need to backfill NULLs first)
        const zeroVal = desired.defaultExpr ?? getZeroValue(desired.pgType);
        if (zeroVal === "NULL" && !desired.defaultExpr) {
          throw new PostgresSyncError(
            `Cannot set NOT NULL on ${quoteIdentifier(desired.name)} on ${q}: ` +
              `type ${desired.pgType} has no zero value for backfill — provide an explicit default`,
          );
        }
        ops.push({
          type: "backfill_column",
          severity: "warning",
          schema,
          table,
          description: `Backfill NULLs on ${quoteIdentifier(desired.name)} on ${q}`,
          sql: `UPDATE ${q} SET ${quoteIdentifier(desired.name)} = ${zeroVal} WHERE ${quoteIdentifier(desired.name)} IS NULL;`,
          autocommit: false,
        });
        ops.push({
          type: "alter_column_nullable",
          severity: "warning",
          schema,
          table,
          description: `Set NOT NULL on ${quoteIdentifier(desired.name)} on ${q}`,
          sql: `ALTER TABLE ${q} ALTER COLUMN ${quoteIdentifier(desired.name)} SET NOT NULL;`,
          autocommit: false,
        });
      }
    }

    // Default change (skip for identity, generated, and fully replaced columns)
    if (
      !columnReplaced &&
      !desired.isIdentity &&
      !desired.isGenerated &&
      !db.isIdentity &&
      !db.isGenerated
    ) {
      const normalizedDbDefault = normalizeDefaultExpressions(db.defaultExpr);
      const normalizedDesiredDefault = normalizeDefaultExpressions(desired.defaultExpr);

      if (normalizedDbDefault !== normalizedDesiredDefault) {
        if (desired.defaultExpr) {
          ops.push({
            type: "alter_column_default",
            severity: "safe",
            schema,
            table,
            description: `Set default on ${quoteIdentifier(desired.name)} on ${q}`,
            sql: `ALTER TABLE ${q} ALTER COLUMN ${quoteIdentifier(desired.name)} SET DEFAULT ${desired.defaultExpr};`,
            autocommit: false,
          });
        } else {
          ops.push({
            type: "alter_column_default",
            severity: "safe",
            schema,
            table,
            description: `Drop default from ${quoteIdentifier(desired.name)} on ${q}`,
            sql: `ALTER TABLE ${q} ALTER COLUMN ${quoteIdentifier(desired.name)} DROP DEFAULT;`,
            autocommit: false,
          });
        }
      }
    }

    // Collation change (only when type did NOT change — type change already includes COLLATE)
    if (
      !columnReplaced &&
      normalizedDbType === normalizedDesiredType &&
      (desired.collation ?? null) !== (db.collation ?? null)
    ) {
      const collateExpr = desired.collation
        ? ` COLLATE ${quoteIdentifier(desired.collation)}`
        : "";
      ops.push({
        type: "alter_column_type",
        severity: "warning",
        schema,
        table,
        description: `Change collation on ${quoteIdentifier(desired.name)} on ${q}`,
        sql: `ALTER TABLE ${q} ALTER COLUMN ${quoteIdentifier(desired.name)} TYPE ${desired.pgType}${collateExpr};`,
        autocommit: false,
      });
    }
  }

  return ops;
};
