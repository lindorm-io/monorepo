import type { IAmphora } from "@lindorm/amphora";
import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import { getUpsertSetSkipColumns } from "../../../../utils/sql/get-upsert-set-skip-columns";
import { ProteusRepositoryError } from "../../../../../errors/ProteusRepositoryError";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";
import type { CompiledSql } from "./compiled-sql";
import { applyDiscriminatorColumn } from "./compile-insert";
import { dehydrateEntity } from "./dehydrate-entity";
import { resolveTableName } from "./resolve-table-name";

/**
 * Compile an upsert for MySQL using INSERT ... AS _new ON DUPLICATE KEY UPDATE.
 *
 * MySQL does not have ON CONFLICT -- it uses ON DUPLICATE KEY UPDATE.
 * The `AS _new` clause (MySQL 8.0.19+) allows referencing the new row values.
 *
 * MySQL has no RETURNING clause. The executor must follow up with a SELECT-back
 * using compileSelectByPk to retrieve the hydrated row.
 */
export const compileUpsert = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql => {
  // Joined inheritance children cannot be upserted -- multi-table upsert is not
  // expressible as a single ON DUPLICATE KEY UPDATE statement
  if (
    metadata.inheritance?.strategy === "joined" &&
    metadata.inheritance.discriminatorValue != null
  ) {
    throw new ProteusRepositoryError(
      "Upsert is not supported for joined inheritance entities",
    );
  }

  const columns = dehydrateEntity(entity, metadata, "insert", amphora);

  // Ensure discriminator column is present with the correct value for single-table children
  applyDiscriminatorColumn(columns, metadata);

  const resolved = resolveTableName(metadata, namespace);
  const tableName = quoteQualifiedName(resolved.schema, resolved.name);

  const colNames = columns.map((c) => quoteIdentifier(c.column));
  const params: Array<unknown> = columns.map((c) => c.value);
  const placeholders = columns.map(() => "?");

  // SET clause: all mutable columns (exclude PK, CreateDate, Generated increment)
  const setClauses = buildSetClauses(columns, metadata, tableName);

  const text = [
    `INSERT INTO ${tableName} (${colNames.join(", ")})`,
    `VALUES (${placeholders.join(", ")})`,
    `AS ${quoteIdentifier("_new")}`,
    `ON DUPLICATE KEY UPDATE ${setClauses.join(", ")}`,
  ].join(" ");

  return { text, params };
};

const buildSetClauses = (
  columns: Array<{ column: string; value: unknown }>,
  metadata: EntityMetadata,
  tableName: string,
): Array<string> => {
  const setClauses: Array<string> = [];
  const skipColumns = getUpsertSetSkipColumns(metadata);

  const versionField = metadata.fields.find((f) => f.decorator === "Version");
  const updateDateField = metadata.fields.find((f) => f.decorator === "UpdateDate");

  for (const col of columns) {
    if (skipColumns.has(col.column)) continue;

    const quotedCol = quoteIdentifier(col.column);

    // Version field: increment on conflict
    if (versionField && col.column === versionField.name) {
      setClauses.push(`${quotedCol} = ${tableName}.${quotedCol} + 1`);
      continue;
    }

    // UpdateDate field: set to NOW(3) on conflict
    if (updateDateField && col.column === updateDateField.name) {
      setClauses.push(`${quotedCol} = NOW(3)`);
      continue;
    }

    // Use _new alias for all other mutable columns
    setClauses.push(`${quotedCol} = ${quoteIdentifier("_new")}.${quotedCol}`);
  }

  return setClauses;
};
