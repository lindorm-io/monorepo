import type { SqlDialect } from "../../../utils/sql/sql-dialect.js";
import { ProteusError } from "../../../../errors/index.js";
import type { LockMode } from "../../../../types/find-options.js";

const quoteIdentifier = (name: string): string => {
  if (!name) {
    throw new ProteusError("Identifier cannot be empty");
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

  compileHas: (col, params, value) => {
    params.push(JSON.stringify(value));
    return `JSON_CONTAINS(${col}, CAST(? AS JSON))`;
  },

  compileAll: (col, params, arr) => {
    if (arr.length === 0) {
      return "1=1";
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
    if (arr.length === 0) {
      return `(${col} IS NULL OR JSON_LENGTH(${col}) = 0)`;
    }
    params.push(JSON.stringify(arr));
    return `JSON_CONTAINS(?, ${col})`;
  },

  compileLength: (col, params, value) => {
    params.push(value);
    return `(${col} IS NOT NULL AND COALESCE(JSON_LENGTH(${col}), 0) = ?)`;
  },

  joinedDeleteSyntax: "multi-table",
  joinedUpdateManySyntax: "multi-table",

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
