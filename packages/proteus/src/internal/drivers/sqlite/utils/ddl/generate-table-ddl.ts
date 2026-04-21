import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { quoteIdentifier } from "../quote-identifier.js";
import { resolveColumnNameSafe } from "../resolve-column-name.js";
import { generateCheckDDL } from "./generate-check-ddl.js";
import { generateColumnDDL } from "./generate-column-ddl.js";
import { generateUniqueDDL } from "./generate-unique-ddl.js";
import { generateInlineFkDDL } from "./generate-fk-ddl.js";

/**
 * Generates a `CREATE TABLE IF NOT EXISTS` statement for the given entity.
 * Includes columns, primary key (with AUTOINCREMENT if applicable), inline FK
 * constraints, check constraints, and unique constraints.
 *
 * SQLite differences from PG:
 * - No schema qualification (no namespaces)
 * - FKs are inline (not separate ALTER TABLE)
 * - AUTOINCREMENT is part of the PK column definition
 * - No enum types (CHECK constraints are inline on columns)
 */
export const generateTableDDL = (metadata: EntityMetadata, tableName: string): string => {
  const lines: Array<string> = [];

  // Columns
  lines.push(...generateColumnDDL(metadata, tableName));

  // Check if any PK column uses autoincrement
  const isAutoincrement =
    metadata.primaryKeys.length === 1 &&
    metadata.generated.some(
      (g) => g.key === metadata.primaryKeys[0] && g.strategy === "increment",
    );

  if (isAutoincrement) {
    // For AUTOINCREMENT, the PK is declared inline on the column.
    // Find the PK column line and append PRIMARY KEY AUTOINCREMENT.
    const pkFieldName = resolveColumnNameSafe(metadata.fields, metadata.primaryKeys[0]);
    const quotedPk = quoteIdentifier(pkFieldName);
    const idx = lines.findIndex((l) => l.startsWith(quotedPk));
    if (idx !== -1) {
      lines[idx] = `${lines[idx]} PRIMARY KEY AUTOINCREMENT`;
    }
  } else {
    // Composite or non-autoincrement PK
    const pkCols = metadata.primaryKeys
      .map((k) => quoteIdentifier(resolveColumnNameSafe(metadata.fields, k)))
      .join(", ");
    lines.push(`PRIMARY KEY (${pkCols})`);
  }

  // Inline FK constraints
  lines.push(...generateInlineFkDDL(metadata));

  // Check constraints
  lines.push(...generateCheckDDL(metadata.checks, tableName));

  // Unique constraints
  lines.push(...generateUniqueDDL(metadata.uniques, tableName, metadata.fields));

  const body = lines.map((l) => `  ${l}`).join(",\n");

  return `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(tableName)} (\n${body}\n);`;
};
