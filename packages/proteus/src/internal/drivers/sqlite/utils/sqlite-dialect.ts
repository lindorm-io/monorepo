import { isObject } from "@lindorm/is";
import type { SqlDialect } from "#internal/utils/sql/sql-dialect";
import { NotSupportedError, ProteusError } from "../../../../errors";
import type { LockMode } from "../../../../types/find-options";

const quoteIdentifier = (name: string): string => {
  if (!name) {
    throw new ProteusError("Identifier cannot be empty");
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

  compileHas: (col, params, value) => {
    if (isObject(value) && Object.keys(value as Record<string, unknown>).length > 0) {
      // Object containment: check each key/value pair via json_extract
      // Returns multiple clauses joined with AND — caller must handle
      const clauses: Array<string> = [];
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        const escapedKey = k.replace(/"/g, '""');
        if (typeof v === "object" && v !== null) {
          params.push(JSON.stringify(v));
          clauses.push(`json_extract(${col}, '$."${escapedKey}"') = json(?)`);
        } else {
          params.push(v);
          clauses.push(`json_extract(${col}, '$."${escapedKey}"') = ?`);
        }
      }
      return clauses.length === 1 ? clauses[0] : `(${clauses.join(" AND ")})`;
    }

    // Primitive or array containment: use json_each
    params.push(JSON.stringify(value));
    return `EXISTS(SELECT 1 FROM json_each(${col}) WHERE json_each.value = json(?))`;
  },

  compileAll: (col, params, arr) => {
    if (arr.length === 0) {
      return "1=1";
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
    if (arr.length === 0) {
      return `(${col} IS NULL OR json_array_length(${col}) = 0)`;
    }
    const placeholders = arr
      .map((v) => {
        params.push(v);
        return "?";
      })
      .join(", ");
    return `NOT EXISTS (SELECT 1 FROM json_each(${col}) WHERE value NOT IN (${placeholders}))`;
  },

  compileLength: (col, params, value) => {
    params.push(value);
    return `(${col} IS NOT NULL AND COALESCE(json_array_length(${col}), 0) = ?)`;
  },

  joinedDeleteSyntax: "subquery",
  joinedUpdateManySyntax: "subquery",

  compileLockClause: (lock: LockMode | null): string => {
    if (lock) {
      throw new NotSupportedError(
        `Pessimistic lock mode "${lock}" is not supported by the SQLite driver. SQLite uses database-level locking via transactions.`,
      );
    }
    return "";
  },

  compileCompositePkExpression: (quotedColumns: Array<string>): string =>
    quotedColumns.join(" || '|' || "),
};
