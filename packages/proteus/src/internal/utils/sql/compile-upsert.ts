import type { IAmphora } from "@lindorm/amphora";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError.js";
import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import { applyDiscriminatorColumn } from "./apply-discriminator-column.js";
import type { CompiledSql } from "./compiled-sql.js";
import { getUpsertSetSkipColumns } from "./get-upsert-set-skip-columns.js";
import { resolveTableName } from "./resolve-table-name.js";
import type { SqlDialect } from "./sql-dialect.js";
import type { DehydrateEntityFn } from "./write-compiler-deps.js";

export type UpsertCompileOptions = {
  conflictColumns?: Array<string>;
};

export type CompileUpsertDeps = {
  dehydrateEntity: DehydrateEntityFn;
  /**
   * Resolves the conflict target to quoted column names — explicit columns or
   * primary key columns. Kept per driver: PG resolves entity keys through
   * resolveColumnName (incl. relations), SQLite quotes them raw, MySQL has no
   * conflict target (ON DUPLICATE KEY UPDATE) and returns [].
   */
  resolveConflictColumns: (
    metadata: EntityMetadata,
    conflictColumns?: Array<string>,
  ) => Array<string>;
};

/**
 * Compiles an INSERT with a conflict-update clause (upsert).
 *
 * The conflict clause comes from `dialect.buildUpsertConflictClause`:
 * `ON CONFLICT (...) DO UPDATE SET` (PG/SQLite) or `AS _new ON DUPLICATE KEY
 * UPDATE` (MySQL). `RETURNING *` is appended when the dialect supports it;
 * otherwise the executor must SELECT the row back.
 */
export const compileUpsert = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  dialect: SqlDialect,
  deps: CompileUpsertDeps,
  namespace?: string | null,
  options?: UpsertCompileOptions,
  amphora?: IAmphora,
): CompiledSql => {
  // Joined inheritance children cannot be upserted — multi-table upsert is not
  // expressible as a single conflict-update statement
  if (
    metadata.inheritance?.strategy === "joined" &&
    metadata.inheritance.discriminatorValue != null
  ) {
    throw new ProteusRepositoryError(
      "Upsert is not supported for joined inheritance entities",
      {
        code: "unsupported_operation",
        title: "Unsupported Operation",
        details: `Joined-inheritance entity "${metadata.entity.name}" spans multiple tables, so a single-statement upsert cannot be compiled.`,
        data: { operation: "upsert" },
      },
    );
  }

  const columns = deps.dehydrateEntity(entity, metadata, "insert", amphora);

  // Ensure discriminator column is present with the correct value for single-table children
  applyDiscriminatorColumn(columns, metadata);

  const resolved = resolveTableName(metadata, dialect, namespace);
  const tableName = dialect.quoteQualifiedName(resolved.schema, resolved.name);

  const colNames = columns.map((c) => dialect.quoteIdentifier(c.column));
  const params: Array<unknown> = [];
  const placeholders = columns.map((c) => {
    params.push(c.value);
    return dialect.placeholder(params);
  });

  const conflictCols = deps.resolveConflictColumns(metadata, options?.conflictColumns);

  // SET clause: all mutable columns (exclude PK, CreateDate, Generated increment)
  const setClauses = buildSetClauses(columns, metadata, tableName, dialect);

  const parts = [
    `INSERT INTO ${tableName} (${colNames.join(", ")})`,
    `VALUES (${placeholders.join(", ")})`,
    dialect.buildUpsertConflictClause(conflictCols, setClauses),
  ];
  if (dialect.supportsReturning) {
    parts.push("RETURNING *");
  }

  return { text: parts.join(" "), params };
};

const buildSetClauses = (
  columns: Array<{ column: string; value: unknown }>,
  metadata: EntityMetadata,
  tableName: string,
  dialect: SqlDialect,
): Array<string> => {
  const setClauses: Array<string> = [];
  const skipColumns = getUpsertSetSkipColumns(metadata);

  const versionField = metadata.fields.find((f) => f.decorator === "Version");
  const updateDateField = metadata.fields.find((f) => f.decorator === "UpdateDate");

  for (const col of columns) {
    if (skipColumns.has(col.column)) continue;

    const quotedCol = dialect.quoteIdentifier(col.column);

    // Version field: increment on conflict
    if (versionField && col.column === versionField.name) {
      setClauses.push(`${quotedCol} = ${tableName}.${quotedCol} + 1`);
      continue;
    }

    // UpdateDate field: set to the dialect's now-expression on conflict
    if (updateDateField && col.column === updateDateField.name) {
      setClauses.push(`${quotedCol} = ${dialect.dateNowExpression()}`);
      continue;
    }

    // Reference the incoming row for all other mutable columns
    setClauses.push(`${quotedCol} = ${dialect.upsertExcludedRef(quotedCol)}`);
  }

  return setClauses;
};
