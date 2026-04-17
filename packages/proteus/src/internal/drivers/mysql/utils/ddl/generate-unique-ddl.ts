import { ProteusError } from "../../../../../errors";
import type { MetaField, MetaUnique } from "../../../../entity/types/metadata";
import {
  INDEX_PREFIX_LENGTH,
  MYSQL_IDENTIFIER_LIMIT,
} from "../../constants/mysql-constants";
import { hashIdentifier } from "../hash-identifier";
import { quoteIdentifier } from "../quote-identifier";
import { requiresIndexPrefix } from "../requires-index-prefix";
import { resolveColumnNameSafe } from "../resolve-column-name";

/**
 * Generates inline `UNIQUE KEY ...` clauses for use inside `CREATE TABLE`.
 * Auto-generates a hash-based constraint name if none is provided.
 *
 * MySQL uses `UNIQUE KEY` syntax (equivalent to `UNIQUE INDEX`).
 * TEXT/BLOB columns get a prefix length for indexing.
 */
export const generateUniqueDDL = (
  uniques: Array<MetaUnique>,
  tableName: string,
  fields: Array<MetaField>,
): Array<string> => {
  const statements: Array<string> = [];

  for (const unique of uniques) {
    if (unique.keys.length === 0) {
      throw new ProteusError(
        `Unique constraint on "${tableName}" has no keys — UNIQUE () is invalid SQL`,
      );
    }
    const resolvedKeys = unique.keys.map((k) => resolveColumnNameSafe(fields, k));
    const cols = resolvedKeys
      .map((colName) => {
        const field = fields.find((f) => f.name === colName || f.key === colName);
        const quoted = quoteIdentifier(colName);
        return requiresIndexPrefix(field) ? `${quoted}(${INDEX_PREFIX_LENGTH})` : quoted;
      })
      .join(", ");
    const autoName = `uq_${hashIdentifier(`${tableName}_${resolvedKeys.join("_")}`)}`;
    if (unique.name && unique.name.length > MYSQL_IDENTIFIER_LIMIT) {
      throw new ProteusError(
        `Unique constraint name exceeds ${MYSQL_IDENTIFIER_LIMIT} characters: "${unique.name}"`,
      );
    }
    const name = unique.name ?? autoName;

    statements.push(`UNIQUE KEY ${quoteIdentifier(name)} (${cols})`);
  }

  return statements;
};
