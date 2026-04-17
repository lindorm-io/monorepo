import { ProteusError } from "../../../../../errors";
import type { MetaField, MetaIndex } from "../../../../entity/types/metadata";
import { SQLITE_IDENTIFIER_LIMIT } from "../../constants/sqlite-constants";
import { hashIdentifier } from "../hash-identifier";
import { quoteIdentifier } from "../quote-identifier";
import { resolveColumnNameSafe } from "../resolve-column-name";

const VALID_DIRECTIONS = new Set(["asc", "desc"]);

/**
 * Generates `CREATE [UNIQUE] INDEX IF NOT EXISTS` statements for the given entity indexes.
 *
 * SQLite differences from PG:
 * - No USING clause (only btree-like index, no keyword needed)
 * - No CONCURRENTLY
 * - No INCLUDE (covering index)
 * - No WITH storage params
 * - Supports partial indexes (WHERE clause)
 * - Supports column direction and NULLS ordering
 */
export const generateIndexDDL = (
  indexes: Array<MetaIndex>,
  tableName: string,
  fields: Array<MetaField>,
): Array<string> => {
  const statements: Array<string> = [];

  for (const index of indexes) {
    const validKeys = index.keys.filter((k) => VALID_DIRECTIONS.has(k.direction));
    if (validKeys.length === 0) continue;

    const cols = validKeys
      .map((k) => {
        let col = `${quoteIdentifier(resolveColumnNameSafe(fields, k.key))} ${k.direction.toUpperCase()}`;
        if (k.nulls) col += ` NULLS ${k.nulls.toUpperCase()}`;
        return col;
      })
      .join(", ");

    // Auto-name or use provided name
    const resolvedKeyNames = validKeys.map((k) => resolveColumnNameSafe(fields, k.key));
    const autoName = `idx_${hashIdentifier(`${tableName}_${resolvedKeyNames.join("_")}`)}`;
    if (index.name && index.name.length > SQLITE_IDENTIFIER_LIMIT) {
      throw new ProteusError(
        `Index name exceeds ${SQLITE_IDENTIFIER_LIMIT} characters: "${index.name}"`,
      );
    }
    const name = index.name ?? autoName;

    const unique = index.unique ? "UNIQUE " : "";

    let stmt =
      `CREATE ${unique}INDEX IF NOT EXISTS ${quoteIdentifier(name)}` +
      ` ON ${quoteIdentifier(tableName)} (${cols})`;

    // Partial index: explicit where takes precedence, then sparse
    if (index.where) {
      stmt += ` WHERE ${index.where}`;
    } else if (index.sparse) {
      const nullChecks = validKeys
        .map(
          (k) => `${quoteIdentifier(resolveColumnNameSafe(fields, k.key))} IS NOT NULL`,
        )
        .join(" AND ");
      stmt += ` WHERE ${nullChecks}`;
    }

    statements.push(stmt + ";");
  }

  return statements;
};
