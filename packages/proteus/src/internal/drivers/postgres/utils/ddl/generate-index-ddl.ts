import { ProteusError } from "../../../../../errors";
import type { MetaField, MetaIndex } from "../../../../entity/types/metadata";
import { PG_IDENTIFIER_LIMIT } from "../../constants/postgres-constants";
import { hashIdentifier } from "../hash-identifier";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";
import { resolveColumnNameSafe } from "../resolve-column-name";

const VALID_DIRECTIONS = new Set(["asc", "desc"]);

const VALID_INDEX_METHODS = new Set(["btree", "hash", "gist", "gin", "brin", "spgist"]);

/**
 * Generates `CREATE INDEX IF NOT EXISTS` statements for the given entity indexes.
 * Supports all PostgreSQL index methods (btree, hash, gist, gin, brin, spgist),
 * unique/concurrent flags, INCLUDE columns (covering index), WITH storage params,
 * partial indexes (explicit WHERE or sparse IS NOT NULL), and column direction/nulls.
 * Auto-generates a hash-based name if none is provided and validates the 63-char PG limit.
 */
export const generateIndexDDL = (
  indexes: Array<MetaIndex>,
  tableName: string,
  namespace: string | null,
  fields: Array<MetaField>,
): Array<string> => {
  const qualifiedTable = quoteQualifiedName(namespace, tableName);
  const statements: Array<string> = [];

  for (const index of indexes) {
    // Filter to PG-valid directions only
    const validKeys = index.keys.filter((k) => VALID_DIRECTIONS.has(k.direction));
    if (validKeys.length === 0) continue;

    const cols = validKeys
      .map((k) => {
        let col = `${quoteIdentifier(resolveColumnNameSafe(fields, k.key))} ${k.direction.toUpperCase()}`;
        if (k.nulls) col += ` NULLS ${k.nulls.toUpperCase()}`;
        return col;
      })
      .join(", ");

    // Auto-name or use provided name (validate user-provided names against 63-char limit)
    const resolvedKeyNames = validKeys.map((k) => resolveColumnNameSafe(fields, k.key));
    const autoName = `idx_${hashIdentifier(`${tableName}_${resolvedKeyNames.join("_")}`)}`;
    if (index.name && index.name.length > PG_IDENTIFIER_LIMIT) {
      throw new ProteusError(
        `Index name exceeds ${PG_IDENTIFIER_LIMIT} characters: "${index.name}"`,
      );
    }
    const name = index.name ?? autoName;

    const unique = index.unique ? "UNIQUE " : "";
    const concurrent = index.concurrent ? "CONCURRENTLY " : "";

    let using = "";
    if (index.using) {
      const method = index.using.toLowerCase();
      if (!VALID_INDEX_METHODS.has(method)) {
        throw new ProteusError(`Invalid index method: "${index.using}"`);
      }
      using = ` USING ${method}`;
    }

    let stmt =
      `CREATE ${unique}INDEX ${concurrent}IF NOT EXISTS ${quoteIdentifier(name)}` +
      ` ON ${qualifiedTable}${using} (${cols})`;

    // INCLUDE columns (covering index) — must come before WITH per PG syntax
    if (index.include && index.include.length > 0) {
      const includeCols = index.include
        .map((k) => quoteIdentifier(resolveColumnNameSafe(fields, k)))
        .join(", ");
      stmt += ` INCLUDE (${includeCols})`;
    }

    if (index.with) {
      stmt += ` WITH (${index.with})`;
    }

    // Partial index: explicit where takes precedence, then sparse
    if (index.where) {
      // Raw SQL expression — caller is responsible for correctness and safety
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
