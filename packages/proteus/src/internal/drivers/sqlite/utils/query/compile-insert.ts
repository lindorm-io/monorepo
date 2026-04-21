import type { IAmphora } from "@lindorm/amphora";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier.js";
import type { CompiledSql } from "./compiled-sql.js";
import { dehydrateEntity } from "./dehydrate-entity.js";
import { resolveTableName } from "./resolve-table-name.js";

/**
 * Ensure the discriminator column is present with the correct metadata value
 * for single-table inheritance children. If the column was already included by
 * dehydrateEntity (from the entity instance), its value is overwritten to match
 * the metadata's discriminatorValue.
 *
 * No-op for root entities and non-inheritance entities.
 */
export const applyDiscriminatorColumn = (
  columns: Array<{ column: string; value: unknown }>,
  metadata: EntityMetadata,
): void => {
  if (!metadata.inheritance) return;
  if (metadata.inheritance.discriminatorValue == null) return;

  const field = metadata.fields.find(
    (f) => f.key === metadata.inheritance!.discriminatorField,
  );
  if (!field) return;

  const existing = columns.find((c) => c.column === field.name);
  if (existing) {
    existing.value = metadata.inheritance.discriminatorValue;
  } else {
    columns.push({ column: field.name, value: metadata.inheritance.discriminatorValue });
  }
};

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

  const text = `INSERT INTO ${tableName} (${colNames.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`;

  return { text, params };
};

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

  const text = `INSERT INTO ${tableName} (${colNames.join(", ")}) VALUES ${rowPlaceholders.join(", ")} RETURNING *`;

  return { text, params };
};
