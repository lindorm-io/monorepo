import { ProteusError } from "../../../../../errors";
import type { MetaField, MetaUnique } from "#internal/entity/types/metadata";
import { PG_IDENTIFIER_LIMIT } from "../../constants/postgres-constants";
import { hashIdentifier } from "../hash-identifier";
import { quoteIdentifier } from "../quote-identifier";
import { resolveColumnNameSafe } from "../resolve-column-name";

/**
 * Generates inline `CONSTRAINT ... UNIQUE (...)` clauses for use inside `CREATE TABLE`.
 * Auto-generates a hash-based constraint name if none is provided and validates the
 * 63-char PG identifier limit. Throws if `keys` is empty (UNIQUE () is invalid SQL).
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
    const cols = resolvedKeys.map(quoteIdentifier).join(", ");
    const autoName = `uq_${hashIdentifier(`${tableName}_${resolvedKeys.join("_")}`)}`;
    if (unique.name && unique.name.length > PG_IDENTIFIER_LIMIT) {
      throw new ProteusError(
        `Unique constraint name exceeds ${PG_IDENTIFIER_LIMIT} characters: "${unique.name}"`,
      );
    }
    const name = unique.name ?? autoName;

    statements.push(`CONSTRAINT ${quoteIdentifier(name)} UNIQUE (${cols})`);
  }

  return statements;
};
