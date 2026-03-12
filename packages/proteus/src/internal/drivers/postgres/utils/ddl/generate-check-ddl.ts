import { ProteusError } from "../../../../../errors";
import type { MetaCheck } from "#internal/entity/types/metadata";
import { PG_IDENTIFIER_LIMIT } from "../../constants/postgres-constants";
import { hashIdentifier } from "../hash-identifier";
import { quoteIdentifier } from "../quote-identifier";

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
    if (check.name && check.name.length > PG_IDENTIFIER_LIMIT) {
      throw new ProteusError(
        `Check constraint name exceeds ${PG_IDENTIFIER_LIMIT} characters: "${check.name}"`,
      );
    }
    const name =
      check.name ?? `chk_${hashIdentifier(`${tableName}_${check.expression}`)}`;

    // Raw SQL expression — caller is responsible for correctness and safety
    statements.push(`CONSTRAINT ${quoteIdentifier(name)} CHECK (${check.expression})`);
  }

  return statements;
};
