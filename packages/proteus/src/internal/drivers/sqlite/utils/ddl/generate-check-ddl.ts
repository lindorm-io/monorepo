import { ProteusError } from "../../../../../errors/index.js";
import type { MetaCheck } from "../../../../entity/types/metadata.js";
import { SQLITE_IDENTIFIER_LIMIT } from "../../constants/sqlite-constants.js";
import { hashIdentifier } from "../hash-identifier.js";
import { quoteIdentifier } from "../quote-identifier.js";

/**
 * Generates inline `CONSTRAINT ... CHECK (expr)` clauses for use inside `CREATE TABLE`.
 * The expression is raw SQL — the caller is responsible for correctness and safety.
 * Auto-generates a hash-based constraint name if none is provided.
 */
export const generateCheckDDL = (
  checks: Array<MetaCheck>,
  tableName: string,
): Array<string> => {
  const statements: Array<string> = [];

  for (const check of checks) {
    if (check.name && check.name.length > SQLITE_IDENTIFIER_LIMIT) {
      throw new ProteusError(
        `Check constraint name exceeds ${SQLITE_IDENTIFIER_LIMIT} characters: "${check.name}"`,
      );
    }
    const name =
      check.name ?? `chk_${hashIdentifier(`${tableName}_${check.expression}`)}`;

    // Raw SQL expression — caller is responsible for correctness and safety
    statements.push(`CONSTRAINT ${quoteIdentifier(name)} CHECK (${check.expression})`);
  }

  return statements;
};
