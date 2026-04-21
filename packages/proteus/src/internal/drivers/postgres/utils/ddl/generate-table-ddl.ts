import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { NamespaceOptions } from "../../../../types/types.js";
import { generateUniqueDDL } from "./generate-unique-ddl.js";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier.js";
import { resolveColumnNameSafe } from "../resolve-column-name.js";
import { generateCheckDDL } from "./generate-check-ddl.js";
import { generateColumnDDL } from "./generate-column-ddl.js";

/**
 * Generates a `CREATE TABLE IF NOT EXISTS` statement for the given entity.
 * Includes columns, primary key, check constraints, and unique constraints.
 * FK constraints and indexes are handled separately by `generateFkDDL` and `generateIndexDDL`.
 */
export const generateTableDDL = (
  metadata: EntityMetadata,
  tableName: string,
  namespace: string | null,
  namespaceOptions: NamespaceOptions,
): string => {
  const qualifiedTable = quoteQualifiedName(namespace, tableName);
  const lines: Array<string> = [];

  // Columns
  lines.push(...generateColumnDDL(metadata, tableName, namespace, namespaceOptions));

  // Primary key
  const pkCols = metadata.primaryKeys
    .map((k) => quoteIdentifier(resolveColumnNameSafe(metadata.fields, k)))
    .join(", ");
  lines.push(`PRIMARY KEY (${pkCols})`);

  // Check constraints
  lines.push(...generateCheckDDL(metadata.checks, tableName));

  // Unique constraints
  lines.push(...generateUniqueDDL(metadata.uniques, tableName, metadata.fields));

  const body = lines.map((l) => `  ${l}`).join(",\n");

  return `CREATE TABLE IF NOT EXISTS ${qualifiedTable} (\n${body}\n);`;
};
