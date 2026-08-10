import type { SqlDialect } from "../../../utils/sql/sql-dialect.js";
import { NotSupportedError, ProteusError } from "../../../../errors/index.js";
import type { LockMode } from "../../../../types/find-options.js";
import { compileJsonContains } from "./compile-json-contains.js";

const quoteIdentifier = (name: string): string => {
  if (!name) {
    throw new ProteusError("Identifier cannot be empty", {
      code: "invalid_query",
      title: "Invalid Query",
      details: "A SQL identifier cannot be an empty string.",
    });
  }
  return `"${name.replace(/"/g, '""')}"`;
};

const quoteQualifiedName = (schema: string | null, name: string): string =>
  schema ? `${quoteIdentifier(schema)}.${quoteIdentifier(name)}` : quoteIdentifier(name);

export const sqliteDialect: SqlDialect = {
  quoteIdentifier,
  quoteQualifiedName,

  placeholder: () => "?",

  supportsReturning: true,
  supportsUpdateAlias: false,
  supportsDeleteAlias: false,
  supportsMaterializedCte: false,
  supportsNamespace: false,
  requiresLimitForOffset: false,

  dateNowExpression: () => "strftime('%Y-%m-%dT%H:%M:%fZ','now')",
  booleanLiteral: (value) => (value ? "1" : "0"),

  compileIlike: (col, params, value) => {
    params.push(String(value).toLowerCase());
    return `LOWER(${col}) LIKE LOWER(?)`;
  },

  compileRegex: () => null,

  compileSimilar: () => {
    throw new NotSupportedError(
      "The $similar trigram search operator is only supported by the PostgreSQL driver",
      {
        code: "unsupported_operator",
        title: "Unsupported Operator",
        details:
          "Trigram fuzzy search ($similar) relies on PostgreSQL's pg_trgm extension and is not available on SQLite.",
        data: { operator: "$similar" },
      },
    );
  },

  compileHas: compileJsonContains,

  compileAll: (col, params, arr) => {
    // Every element of an empty list is trivially present — but only in a row
    // that HAS a list. `1=1` said "every row", which handed back the rows whose
    // column is NULL: postgres excludes them (`NULL @> '[]'` is NULL) and so
    // does the condition language, whose `$all` requires an array value.
    if (arr.length === 0) {
      return `${col} IS NOT NULL`;
    }
    const clauses: Array<string> = [];
    for (const v of arr) {
      params.push(v);
      clauses.push(`EXISTS (SELECT 1 FROM json_each(${col}) WHERE value = ?)`);
    }
    return clauses.length === 1 ? clauses[0] : `(${clauses.join(" AND ")})`;
  },

  compileOverlap: (col, params, arr) => {
    if (arr.length === 0) {
      return "1=0";
    }
    const placeholders = arr
      .map((v) => {
        params.push(v);
        return "?";
      })
      .join(", ");
    return `EXISTS (SELECT 1 FROM json_each(${col}) WHERE value IN (${placeholders}))`;
  },

  compileContained: (col, params, arr) => {
    // Contained by the empty set means the row's own list is empty — an EMPTY
    // array, not a missing one. `IS NULL OR` let the NULL rows through, where
    // postgres (`NULL <@ '[]'` is NULL) and the condition language both exclude
    // them.
    if (arr.length === 0) {
      return `(${col} IS NOT NULL AND json_array_length(${col}) = 0)`;
    }
    const placeholders = arr
      .map((v) => {
        params.push(v);
        return "?";
      })
      .join(", ");
    // The NOT NULL guard is what a `NOT EXISTS` over `json_each` cannot supply
    // for itself: `json_each(NULL)` yields no rows, so the negation was
    // VACUOUSLY TRUE and every NULL row came back — the one dialect that let
    // them through where postgres and mysql do not.
    return `(${col} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM json_each(${col}) WHERE value NOT IN (${placeholders})))`;
  },

  // `json_array_length` is not a general length function: it raises "malformed
  // JSON" on a character column and returns 0 for an object, so measuring every
  // column as an array errored on one and silently matched nothing on the other.
  compileLength: (col, params, value, measure) => {
    const lengthExpr =
      measure === "object"
        ? `(SELECT count(*) FROM json_each(${col}))`
        : measure === "string"
          ? `length(${col})`
          : `json_array_length(${col})`;
    params.push(value);
    return `(${col} IS NOT NULL AND COALESCE(${lengthExpr}, 0) = ?)`;
  },

  joinedDeleteSyntax: "subquery",
  joinedUpdateManySyntax: "subquery",

  singleRowUpdateAlias: null,

  buildUpsertConflictClause: (conflictColumns, setClauses) =>
    `ON CONFLICT (${conflictColumns.join(", ")}) DO UPDATE SET ${setClauses.join(", ")}`,
  upsertExcludedRef: (quotedColumn) => `excluded.${quotedColumn}`,

  compileLockClause: (lock: LockMode | null): string => {
    if (lock) {
      throw new NotSupportedError(
        `Pessimistic lock mode "${lock}" is not supported by the SQLite driver. SQLite uses database-level locking via transactions.`,
        {
          code: "unsupported_operation",
          title: "Unsupported Operation",
          details:
            "SQLite does not support pessimistic lock modes; it locks at the database level via transactions.",
          data: { lock },
        },
      );
    }
    return "";
  },

  compileCompositePkExpression: (quotedColumns: Array<string>): string =>
    quotedColumns.join(" || '|' || "),
};
