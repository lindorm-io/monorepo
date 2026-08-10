import type { SqlDialect } from "../../../utils/sql/sql-dialect.js";
import { NotSupportedError, ProteusError } from "../../../../errors/index.js";
import type { LockMode } from "../../../../types/find-options.js";

const quoteIdentifier = (name: string): string => {
  if (!name) {
    throw new ProteusError("Identifier cannot be empty", {
      code: "invalid_query",
      title: "Invalid Query",
      details: "An empty identifier cannot be quoted for use in a MySQL statement.",
    });
  }
  return `\`${name.replace(/`/g, "``")}\``;
};

const quoteQualifiedName = (schema: string | null, name: string): string =>
  schema ? `${quoteIdentifier(schema)}.${quoteIdentifier(name)}` : quoteIdentifier(name);

export const mysqlDialect: SqlDialect = {
  quoteIdentifier,
  quoteQualifiedName,

  placeholder: () => "?",

  supportsReturning: false,
  supportsUpdateAlias: true,
  supportsDeleteAlias: false,
  supportsMaterializedCte: false,
  supportsNamespace: true,
  requiresLimitForOffset: true,

  dateNowExpression: () => "NOW(3)",
  booleanLiteral: (value) => (value ? "TRUE" : "FALSE"),

  compileIlike: (col, params, value) => {
    params.push(value);
    return `LOWER(${col}) LIKE LOWER(?)`;
  },

  compileRegex: (col, params, regex) => {
    const source = regex.source;
    const flags = regex.flags;
    const pattern = flags.includes("i") ? `(?i)${source}` : source;
    params.push(pattern);
    return `${col} REGEXP ?`;
  },

  compileSimilar: () => {
    throw new NotSupportedError(
      "The $similar trigram search operator is only supported by the PostgreSQL driver",
      {
        code: "unsupported_operator",
        title: "Unsupported Operator",
        details:
          "Trigram fuzzy search ($similar) relies on PostgreSQL's pg_trgm extension and is not available on MySQL.",
        data: { operator: "$similar" },
      },
    );
  },

  // `JSON_CONTAINS` is already the containment the condition language means, for
  // an array column and an object one alike, and it already accepts a scalar
  // candidate against an array target.
  compileHas: (col, params, value) => {
    params.push(JSON.stringify(value));
    return `JSON_CONTAINS(${col}, CAST(? AS JSON))`;
  },

  compileAll: (col, params, arr) => {
    // Every element of an empty list is trivially present — but only in a row
    // that HAS a list. `1=1` said "every row", which handed back the rows whose
    // column is NULL: postgres excludes them (`NULL @> '[]'` is NULL) and so
    // does the condition language, whose `$all` requires an array value.
    if (arr.length === 0) {
      return `${col} IS NOT NULL`;
    }
    params.push(JSON.stringify(arr));
    return `JSON_CONTAINS(${col}, ?)`;
  },

  compileOverlap: (col, params, arr) => {
    if (arr.length === 0) {
      return "1=0";
    }
    params.push(JSON.stringify(arr));
    return `JSON_OVERLAPS(${col}, ?)`;
  },

  compileContained: (col, params, arr) => {
    // Contained by the empty set means the row's own list is empty — an EMPTY
    // array, not a missing one. `IS NULL OR` let the NULL rows through, where
    // postgres (`NULL <@ '[]'` is NULL) and the condition language both exclude
    // them.
    if (arr.length === 0) {
      return `(${col} IS NOT NULL AND JSON_LENGTH(${col}) = 0)`;
    }
    params.push(JSON.stringify(arr));
    return `JSON_CONTAINS(?, ${col})`;
  },

  // `JSON_LENGTH` counts array elements AND object keys, so mysql's long-standing
  // object-key behaviour was right — it was simply never decided, it was what
  // measuring every column as JSON happened to do. It still cannot measure a
  // character column: `JSON_LENGTH('abcd')` is "Invalid JSON text".
  compileLength: (col, params, value, measure) => {
    const lengthExpr =
      measure === "string" ? `CHAR_LENGTH(${col})` : `JSON_LENGTH(${col})`;
    params.push(value);
    return `(${col} IS NOT NULL AND COALESCE(${lengthExpr}, 0) = ?)`;
  },

  joinedDeleteSyntax: "multi-table",
  joinedUpdateManySyntax: "multi-table",

  // MySQL supports UPDATE ... AS alias, but single-row updates historically emit
  // unaliased statements (locked by snapshots).
  singleRowUpdateAlias: null,

  // The `AS _new` clause (MySQL 8.0.19+) allows referencing the new row values.
  buildUpsertConflictClause: (_conflictColumns, setClauses) =>
    `AS ${quoteIdentifier("_new")} ON DUPLICATE KEY UPDATE ${setClauses.join(", ")}`,
  upsertExcludedRef: (quotedColumn) => `${quoteIdentifier("_new")}.${quotedColumn}`,

  compileLockClause: (lock: LockMode | null): string => {
    if (!lock) return "";
    switch (lock) {
      case "pessimistic_read":
        return "FOR SHARE";
      case "pessimistic_write":
        return "FOR UPDATE";
      case "pessimistic_read_skip":
        return "FOR SHARE SKIP LOCKED";
      case "pessimistic_read_fail":
        return "FOR SHARE NOWAIT";
      case "pessimistic_write_skip":
        return "FOR UPDATE SKIP LOCKED";
      case "pessimistic_write_fail":
        return "FOR UPDATE NOWAIT";
      default:
        return "";
    }
  },

  compileCompositePkExpression: (quotedColumns: Array<string>): string =>
    `CONCAT(${quotedColumns.join(", '|', ")})`,
};
