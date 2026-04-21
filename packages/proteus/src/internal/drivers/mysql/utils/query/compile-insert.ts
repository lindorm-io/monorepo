import type { IAmphora } from "@lindorm/amphora";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { applyDiscriminatorColumn } from "../../../../utils/sql/apply-discriminator-column.js";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier.js";
import type { CompiledSql } from "./compiled-sql.js";
import { dehydrateEntity } from "./dehydrate-entity.js";
import { resolveTableName } from "./resolve-table-name.js";

export { applyDiscriminatorColumn };

/**
 * Compile an INSERT statement for MySQL.
 *
 * MySQL has no RETURNING clause. The executor must follow up with a SELECT-back
 * using compileSelectByPk to retrieve the hydrated row.
 */
export const compileInsert = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql => {
  const columns = dehydrateEntity(entity, metadata, "insert", amphora);
  const resolved = resolveTableName(metadata, namespace);
  const tableName = quoteQualifiedName(resolved.schema, resolved.name);

  // For single-table inheritance children, ensure the discriminator column is present
  applyDiscriminatorColumn(columns, metadata);

  const colNames = columns.map((c) => quoteIdentifier(c.column));
  const params: Array<unknown> = columns.map((c) => c.value);
  const placeholders = columns.map(() => "?");

  const text = `INSERT INTO ${tableName} (${colNames.join(", ")}) VALUES (${placeholders.join(", ")})`;

  return { text, params };
};

/**
 * Compile a multi-row INSERT statement for MySQL.
 *
 * MySQL has no RETURNING clause. For bulk inserts, the executor typically
 * does not need to SELECT-back each row.
 */
export const compileInsertBulk = <E extends IEntity>(
  entities: Array<E>,
  metadata: EntityMetadata,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql => {
  if (entities.length === 0) {
    throw new Error(
      `compileInsertBulk: entities array must not be empty for "${metadata.entity.name}"`,
    );
  }

  const firstColumns = dehydrateEntity(entities[0], metadata, "insert", amphora);
  const resolved = resolveTableName(metadata, namespace);
  const tableName = quoteQualifiedName(resolved.schema, resolved.name);

  // For single-table inheritance children, ensure the discriminator column is present
  applyDiscriminatorColumn(firstColumns, metadata);

  const colNames = firstColumns.map((c) => quoteIdentifier(c.column));
  const params: Array<unknown> = [];
  const rowPlaceholders: Array<string> = [];

  for (const entity of entities) {
    const columns = dehydrateEntity(entity, metadata, "insert", amphora);

    // Ensure discriminator column is present with correct value for each row
    applyDiscriminatorColumn(columns, metadata);

    const placeholders = columns.map((c) => {
      params.push(c.value);
      return "?";
    });
    rowPlaceholders.push(`(${placeholders.join(", ")})`);
  }

  const text = `INSERT INTO ${tableName} (${colNames.join(", ")}) VALUES ${rowPlaceholders.join(", ")}`;

  return { text, params };
};
