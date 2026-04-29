import type { MetaField } from "../../../entity/types/metadata.js";
import type { SqlDialect } from "../../../utils/sql/sql-dialect.js";
import { ProteusError } from "../../../../errors/index.js";
import type { LockMode } from "../../../../types/find-options.js";

const quoteIdentifier = (name: string): string => {
  if (!name) {
    throw new ProteusError("Identifier cannot be empty");
  }
  return `"${name.replace(/"/g, '""')}"`;
};

const quoteQualifiedName = (schema: string | null, name: string): string =>
  schema ? `${quoteIdentifier(schema)}.${quoteIdentifier(name)}` : quoteIdentifier(name);

/**
 * Get PG array type cast suffix based on field arrayType.
 * Returns `::jsonb` for fields without arrayType (JSONB columns),
 * or `::typename[]` for native PG array columns.
 */
const pgArrayCast = (field: MetaField | null): string => {
  if (!field?.arrayType) return "::jsonb";
  const typeMap: Record<string, string> = {
    string: "text",
    integer: "integer",
    smallint: "smallint",
    bigint: "bigint",
    float: "float8",
    real: "real",
    boolean: "boolean",
    uuid: "uuid",
  };
  const pgType = typeMap[field.arrayType] ?? "text";
  return `::${pgType}[]`;
};

/**
 * Rewrites `$N` placeholders in a SQL fragment to account for an offset
 * and appends the fragment's params to the global params array.
 */
const reindexParams = (
  sql: string,
  fragmentParams: ReadonlyArray<unknown>,
  globalParams: Array<unknown>,
): string => {
  const offset = globalParams.length;
  globalParams.push(...fragmentParams);
  if (offset === 0) return sql;
  return sql.replace(/\$([1-9]\d*)/g, (_, n) => `$${Number(n) + offset}`);
};

export const postgresDialect: SqlDialect = {
  quoteIdentifier,
  quoteQualifiedName,

  placeholder: (params) => `$${params.length}`,

  supportsReturning: true,
  supportsUpdateAlias: true,
  supportsDeleteAlias: true,
  supportsMaterializedCte: true,
  supportsNamespace: true,
  requiresLimitForOffset: false,

  dateNowExpression: () => "NOW()",
  booleanLiteral: (value) => (value ? "TRUE" : "FALSE"),

  compileIlike: (col, params, value) => {
    params.push(value);
    return `${col} ILIKE $${params.length}`;
  },

  compileRegex: (col, params, regex) => {
    params.push(regex.source);
    if (regex.flags.includes("i")) {
      return `${col} ~* $${params.length}`;
    }
    return `${col} ~ $${params.length}`;
  },

  compileHas: (col, params, value) => {
    params.push(JSON.stringify(value));
    return `${col} @> $${params.length}::jsonb`;
  },

  compileAll: (col, params, arr, field) => {
    params.push(arr);
    return `${col} @> $${params.length}${pgArrayCast(field)}`;
  },

  compileOverlap: (col, params, arr, field) => {
    params.push(arr);
    return `${col} && $${params.length}${pgArrayCast(field)}`;
  },

  compileContained: (col, params, arr, field) => {
    params.push(arr);
    return `${col} <@ $${params.length}${pgArrayCast(field)}`;
  },

  compileLength: (col, params, value) => {
    params.push(value);
    return `(${col} IS NOT NULL AND COALESCE(array_length(${col}, 1), 0) = $${params.length})`;
  },

  joinedDeleteSyntax: "using",
  joinedUpdateManySyntax: "from",

  reindexRawParams: reindexParams,

  compileLockClause: (lock: LockMode | null): string => {
    if (!lock) return "";
    const LOCK_MODE_SQL: Record<LockMode, string> = {
      pessimistic_read: "FOR SHARE",
      pessimistic_write: "FOR UPDATE",
      pessimistic_read_skip: "FOR SHARE SKIP LOCKED",
      pessimistic_read_fail: "FOR SHARE NOWAIT",
      pessimistic_write_skip: "FOR UPDATE SKIP LOCKED",
      pessimistic_write_fail: "FOR UPDATE NOWAIT",
    };
    return LOCK_MODE_SQL[lock] ?? "";
  },

  compileCompositePkExpression: (quotedColumns: Array<string>): string =>
    `ROW(${quotedColumns.join(", ")})`,
};
