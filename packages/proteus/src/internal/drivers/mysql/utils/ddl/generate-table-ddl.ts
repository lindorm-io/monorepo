import type { EntityMetadata } from "../../../../entity/types/metadata";
import { quoteIdentifier } from "../quote-identifier";
import { resolveColumnNameSafe } from "../resolve-column-name";
import { generateCheckDDL } from "./generate-check-ddl";
import { generateColumnDDL } from "./generate-column-ddl";
import { generateUniqueDDL } from "./generate-unique-ddl";
import { generateFkDDL } from "./generate-fk-ddl";

/**
 * Generates a `CREATE TABLE IF NOT EXISTS` statement for the given entity.
 * Includes columns, primary key, FK constraints, check constraints, and unique constraints.
 *
 * MySQL differences from SQLite/PG:
 * - No schema qualification (database is specified in connection)
 * - AUTO_INCREMENT instead of AUTOINCREMENT or GENERATED AS IDENTITY
 * - Table options: ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
 * - No DEFERRABLE FK constraints
 * - CHECK constraints supported (MySQL 8.0.16+)
 */
export const generateTableDDL = (metadata: EntityMetadata, tableName: string): string => {
  const lines: Array<string> = [];

  // Columns
  lines.push(...generateColumnDDL(metadata, tableName));

  // Primary key — always as table-level constraint (AUTO_INCREMENT is on the column itself)
  const pkCols = metadata.primaryKeys
    .map((k) => quoteIdentifier(resolveColumnNameSafe(metadata.fields, k)))
    .join(", ");
  lines.push(`PRIMARY KEY (${pkCols})`);

  // FK constraints (inline in CREATE TABLE)
  lines.push(...generateFkDDL(metadata));

  // Check constraints
  lines.push(...generateCheckDDL(metadata.checks, tableName));

  // Unique constraints
  lines.push(...generateUniqueDDL(metadata.uniques, tableName, metadata.fields));

  const body = lines.map((l) => `  ${l}`).join(",\n");

  return (
    `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(tableName)} (\n${body}\n)` +
    ` ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  );
};
