import type { IAmphora } from "@lindorm/amphora";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { ProteusRepositoryError } from "../../../../../errors/ProteusRepositoryError.js";
import { getUpsertSetSkipColumns } from "../../../../utils/sql/get-upsert-set-skip-columns.js";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier.js";
import { resolveColumnName } from "../resolve-column-name.js";
import type { CompiledSql } from "./compiled-sql.js";
import { applyDiscriminatorColumn } from "./compile-insert.js";
import { dehydrateEntity } from "./dehydrate-entity.js";
import { resolveTableName } from "./resolve-table-name.js";

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
      {
        code: "unsupported_operation",
        title: "Unsupported Operation",
        details: `Joined-inheritance entity "${metadata.entity.name}" spans multiple tables, so a single-statement upsert cannot be compiled.`,
        data: { operation: "upsert" },
      },
    );
  }

  const columns = dehydrateEntity(entity, metadata, "insert", amphora);

  // Ensure discriminator column is present with the correct value for single-table children
  applyDiscriminatorColumn(columns, metadata);

  const resolved = resolveTableName(metadata, namespace);
  const tableName = quoteQualifiedName(resolved.schema, resolved.name);

  const colNames = columns.map((c) => quoteIdentifier(c.column));
  const params: Array<unknown> = columns.map((c) => c.value);
  const placeholders = columns.map((_, i) => `$${i + 1}`);

  // Conflict target: explicit columns or primary key columns. In both cases the
  // supplied entity-property keys must be resolved to their DB column names.
  const conflictCols = options?.conflictColumns
    ? options.conflictColumns.map((col) =>
        quoteIdentifier(resolveColumnName(metadata.fields, col, metadata.relations)),
      )
    : metadata.primaryKeys.map((pk) =>
        quoteIdentifier(resolveColumnName(metadata.fields, pk, metadata.relations)),
      );

  // SET clause: all mutable columns (exclude PK, CreateDate, Generated increment)
  const setClauses = buildSetClauses(columns, metadata, params, tableName);

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
  _params: Array<unknown>,
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

    // UpdateDate field: set to NOW() on conflict
    if (updateDateField && col.column === updateDateField.name) {
      setClauses.push(`${quotedCol} = NOW()`);
      continue;
    }

    // Use EXCLUDED pseudo-table for all other mutable columns
    setClauses.push(`${quotedCol} = EXCLUDED.${quotedCol}`);
  }

  return setClauses;
};
