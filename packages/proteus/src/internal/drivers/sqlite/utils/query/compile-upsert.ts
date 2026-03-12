import type { IAmphora } from "@lindorm/amphora";
import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import { ProteusRepositoryError } from "../../../../../errors/ProteusRepositoryError";
import { getUpsertSetSkipColumns } from "#internal/utils/sql/get-upsert-set-skip-columns";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";
import type { CompiledSql } from "./compiled-sql";
import { applyDiscriminatorColumn } from "./compile-insert";
import { dehydrateEntity } from "./dehydrate-entity";
import { resolveTableName } from "./resolve-table-name";

export type UpsertCompileOptions = {
  conflictColumns?: Array<string>;
};

export const compileUpsert = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  namespace?: string | null,
  options?: UpsertCompileOptions,
  amphora?: IAmphora,
): CompiledSql => {
  // Joined inheritance children cannot be upserted — multi-table upsert is not
  // expressible as a single ON CONFLICT statement
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

  // Conflict target: explicit columns or primary key columns
  const conflictCols = options?.conflictColumns
    ? options.conflictColumns.map((col) => quoteIdentifier(col))
    : metadata.primaryKeys.map((pk) => {
        const field = metadata.fields.find((f) => f.key === pk);
        return quoteIdentifier(field?.name ?? pk);
      });

  // SET clause: all mutable columns (exclude PK, CreateDate, Generated increment)
  const setClauses = buildSetClauses(columns, metadata, tableName);

  const text = [
    `INSERT INTO ${tableName} (${colNames.join(", ")})`,
    `VALUES (${placeholders.join(", ")})`,
    `ON CONFLICT (${conflictCols.join(", ")})`,
    `DO UPDATE SET ${setClauses.join(", ")}`,
    `RETURNING *`,
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

    // UpdateDate field: set to ISO 8601 now on conflict
    if (updateDateField && col.column === updateDateField.name) {
      setClauses.push(`${quotedCol} = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`);
      continue;
    }

    // Use excluded pseudo-table for all other mutable columns
    setClauses.push(`${quotedCol} = excluded.${quotedCol}`);
  }

  return setClauses;
};
