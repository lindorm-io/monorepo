import { ProteusError } from "../../../../../errors";
import type { MetaField, MetaIndex } from "#internal/entity/types/metadata";
import {
  INDEX_PREFIX_LENGTH,
  MYSQL_IDENTIFIER_LIMIT,
} from "../../constants/mysql-constants";
import { hashIdentifier } from "../hash-identifier";
import { quoteIdentifier } from "../quote-identifier";
import { requiresIndexPrefix } from "../requires-index-prefix";
import { resolveColumnNameSafe } from "../resolve-column-name";

const VALID_DIRECTIONS = new Set(["asc", "desc"]);

/**
 * Generates `CREATE INDEX` statements for the given entity indexes.
 *
 * MySQL differences from SQLite/PG:
 * - No IF NOT EXISTS (requires MySQL 8.0.29+, we target 8.0.19+)
 * - No CONCURRENTLY
 * - No INCLUDE (covering indexes)
 * - No partial/sparse indexes (WHERE clause not supported)
 * - TEXT/BLOB columns get a 191-char prefix for indexing
 * - BTREE is the default method (no need to specify USING)
 * - Supports column direction (ASC/DESC) and NULLS ordering is not supported
 */
export const generateIndexDDL = (
  indexes: Array<MetaIndex>,
  tableName: string,
  fields: Array<MetaField>,
  warnings?: Array<string>,
): Array<string> => {
  const statements: Array<string> = [];

  for (const index of indexes) {
    const validKeys = index.keys.filter((k) => VALID_DIRECTIONS.has(k.direction));
    if (validKeys.length === 0) {
      throw new ProteusError(
        `Index has no valid key directions on table "${tableName}". ` +
          `Each index key must have direction "asc" or "desc".`,
      );
    }

    // Warn about unsupported features
    if (index.sparse || index.where) {
      const msg = `MySQL does not support partial/sparse indexes. Ignoring WHERE/sparse on index for table "${tableName}".`;
      if (warnings) {
        warnings.push(msg);
      } else {
        throw new ProteusError(msg);
      }
    }

    const cols = validKeys
      .map((k) => {
        const colName = resolveColumnNameSafe(fields, k.key);
        const field = fields.find((f) => f.name === colName || f.key === k.key);
        let col = quoteIdentifier(colName);

        // Apply prefix length for large column types
        if (requiresIndexPrefix(field)) {
          // JSON columns cannot be indexed directly in MySQL
          if (
            field &&
            (field.type === "json" || field.type === "object" || field.type === "array")
          ) {
            const msg = `MySQL does not support indexing JSON columns directly. Index on "${colName}" in table "${tableName}" may fail.`;
            if (warnings) {
              warnings.push(msg);
            }
          } else {
            col += `(${INDEX_PREFIX_LENGTH})`;
          }
        }

        col += ` ${k.direction.toUpperCase()}`;
        // MySQL does not support NULLS FIRST/LAST in index definitions
        return col;
      })
      .join(", ");

    // Auto-name or use provided name
    const resolvedKeyNames = validKeys.map((k) => resolveColumnNameSafe(fields, k.key));
    const autoName = `idx_${hashIdentifier(`${tableName}_${resolvedKeyNames.join("_")}`)}`;
    if (index.name && index.name.length > MYSQL_IDENTIFIER_LIMIT) {
      throw new ProteusError(
        `Index name exceeds ${MYSQL_IDENTIFIER_LIMIT} characters: "${index.name}"`,
      );
    }
    const name = index.name ?? autoName;

    const unique = index.unique ? "UNIQUE " : "";

    const stmt =
      `CREATE ${unique}INDEX ${quoteIdentifier(name)}` +
      ` ON ${quoteIdentifier(tableName)} (${cols});`;

    statements.push(stmt);
  }

  return statements;
};
