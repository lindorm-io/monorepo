import type { IAmphora } from "@lindorm/amphora";
import { ProteusError } from "../../../errors/ProteusError.js";
import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import { applyDiscriminatorColumn } from "./apply-discriminator-column.js";
import type { CompiledSql } from "./compiled-sql.js";
import { resolveTableName } from "./resolve-table-name.js";
import type { SqlDialect } from "./sql-dialect.js";
import type { DehydrateEntityFn } from "./write-compiler-deps.js";

export type CompileInsertDeps = {
  dehydrateEntity: DehydrateEntityFn;
};

/**
 * Compiles an `INSERT INTO ... VALUES (...)` for a single entity.
 *
 * Appends `RETURNING *` when the dialect supports it; otherwise the executor
 * must SELECT the row back (e.g. MySQL via compileSelectByPk).
 */
export const compileInsert = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  dialect: SqlDialect,
  deps: CompileInsertDeps,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql => {
  const columns = deps.dehydrateEntity(entity, metadata, "insert", amphora);
  const resolved = resolveTableName(metadata, dialect, namespace);
  const tableName = dialect.quoteQualifiedName(resolved.schema, resolved.name);

  // For single-table inheritance children, ensure the discriminator column is present
  // with the correct metadata value (overrides any user-set value on the entity instance)
  applyDiscriminatorColumn(columns, metadata);

  const colNames = columns.map((c) => dialect.quoteIdentifier(c.column));
  const params: Array<unknown> = [];
  const placeholders = columns.map((c) => {
    params.push(c.value);
    return dialect.placeholder(params);
  });

  const returning = dialect.supportsReturning ? " RETURNING *" : "";
  const text = `INSERT INTO ${tableName} (${colNames.join(", ")}) VALUES (${placeholders.join(", ")})${returning}`;

  return { text, params };
};

/**
 * Compiles a multi-row `INSERT INTO ... VALUES (...), (...)` statement.
 * Throws when the entities array is empty (would produce invalid SQL).
 */
export const compileInsertBulk = <E extends IEntity>(
  entities: Array<E>,
  metadata: EntityMetadata,
  dialect: SqlDialect,
  deps: CompileInsertDeps,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql => {
  if (entities.length === 0) {
    throw new ProteusError(
      `compileInsertBulk: entities array must not be empty for "${metadata.entity.name}"`,
      {
        code: "invalid_query",
        title: "Invalid Query",
        details: `A bulk INSERT for "${metadata.entity.name}" was compiled with an empty entities array, which produces invalid SQL.`,
        data: { entity: metadata.entity.name },
      },
    );
  }

  const firstColumns = deps.dehydrateEntity(entities[0], metadata, "insert", amphora);
  const resolved = resolveTableName(metadata, dialect, namespace);
  const tableName = dialect.quoteQualifiedName(resolved.schema, resolved.name);

  // For single-table inheritance children, ensure the discriminator column is present
  applyDiscriminatorColumn(firstColumns, metadata);

  const colNames = firstColumns.map((c) => dialect.quoteIdentifier(c.column));
  const params: Array<unknown> = [];
  const rowPlaceholders: Array<string> = [];

  for (const entity of entities) {
    const columns = deps.dehydrateEntity(entity, metadata, "insert", amphora);

    // Ensure discriminator column is present with correct value for each row
    applyDiscriminatorColumn(columns, metadata);

    const placeholders = columns.map((c) => {
      params.push(c.value);
      return dialect.placeholder(params);
    });
    rowPlaceholders.push(`(${placeholders.join(", ")})`);
  }

  const returning = dialect.supportsReturning ? " RETURNING *" : "";
  const text = `INSERT INTO ${tableName} (${colNames.join(", ")}) VALUES ${rowPlaceholders.join(", ")}${returning}`;

  return { text, params };
};
