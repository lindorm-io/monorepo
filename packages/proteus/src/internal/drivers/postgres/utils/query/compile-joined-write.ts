import type { IAmphora } from "@lindorm/amphora";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier.js";
import type { CompiledSql } from "./compiled-sql.js";
import { dehydrateEntity } from "./dehydrate-entity.js";
import { resolveTableName, buildDiscriminatorPredicate } from "./resolve-table-name.js";
import {
  partitionJoinedFields,
  type JoinedFieldPartition,
} from "./partition-joined-fields.js";
import { getEntityName } from "../../../../entity/utils/get-entity-name.js";

export type JoinedInsertSql = {
  rootSql: CompiledSql;
  childSql: CompiledSql;
  /**
   * Maps each primary key field key to its parameter index in childSql.params.
   * Used by the executor to patch generated PK values from the root RETURNING row.
   */
  childPkParamIndices: Map<string, number>;
  partition: JoinedFieldPartition;
};

export type JoinedUpdateSql = {
  rootSql: CompiledSql | null;
  childSql: CompiledSql | null;
  partition: JoinedFieldPartition;
};

/**
 * Ensure the discriminator column is present with the correct metadata value
 * for joined inheritance children. Works identically to the single-table version.
 */
const applyDiscriminatorColumn = (
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

/**
 * Get the discriminator column name for filtering (read-only after creation).
 */
const getDiscriminatorColumnName = (metadata: EntityMetadata): string | null => {
  if (!metadata.inheritance) return null;
  if (metadata.inheritance.discriminatorValue == null) return null;

  const field = metadata.fields.find(
    (f) => f.key === metadata.inheritance!.discriminatorField,
  );
  return field?.name ?? null;
};

/**
 * Compile a multi-table INSERT for a joined inheritance child entity.
 *
 * Returns two SQL statements:
 * 1. rootSql: INSERT into root table (root fields + discriminator)
 * 2. childSql: INSERT into child table (child fields + PK)
 *
 * The executor must run rootSql first, then childSql, within a transaction.
 * PK values from the root INSERT RETURNING are used for the child INSERT.
 */
export const compileJoinedInsert = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  namespace?: string | null,
  amphora?: IAmphora,
): JoinedInsertSql | null => {
  const partition = partitionJoinedFields(metadata);
  if (!partition) return null;

  // ─── Root table INSERT ───
  // Build a temporary metadata-like structure with only root fields for dehydration
  const rootColumns = dehydrateEntity(entity, partition.rootMetadata, "insert", amphora);
  const rootResolved = resolveTableName(metadata, namespace);
  const rootTableName = quoteQualifiedName(rootResolved.schema, rootResolved.name);

  // Ensure discriminator column is present on root
  applyDiscriminatorColumn(rootColumns, metadata);

  const rootColNames = rootColumns.map((c) => quoteIdentifier(c.column));
  const rootParams: Array<unknown> = rootColumns.map((c) => c.value);
  const rootPlaceholders = rootColumns.map((_, i) => `$${i + 1}`);

  const rootText = `INSERT INTO ${rootTableName} (${rootColNames.join(", ")}) VALUES (${rootPlaceholders.join(", ")}) RETURNING *`;
  const rootSql: CompiledSql = { text: rootText, params: rootParams };

  // ─── Child table INSERT ───
  // Child table: child-only fields + PK columns
  const childEntityName = getEntityName(metadata.target, {
    namespace: namespace ?? undefined,
  });
  const childTableName = quoteQualifiedName(
    childEntityName.namespace ?? null,
    childEntityName.name,
  );

  const childColumns: Array<{ column: string; value: unknown }> = [];

  // Track the parameter index for each PK field key so the executor can
  // patch generated PK values from the root RETURNING row without relying
  // on positional assumptions.
  const childPkParamIndices = new Map<string, number>();

  // Add PK columns first (same values as root)
  for (const pk of metadata.primaryKeys) {
    const field = metadata.fields.find((f) => f.key === pk);
    const colName = field?.name ?? pk;
    childPkParamIndices.set(pk, childColumns.length);
    childColumns.push({ column: colName, value: (entity as any)[pk] });
  }

  // Add child-only fields via dehydration of the full entity, then filter
  const allColumns = dehydrateEntity(entity, metadata, "insert", amphora);
  const rootFieldNames = new Set(partition.rootFields.map((f) => f.name));
  const pkColNames = new Set(
    metadata.primaryKeys.map((pk) => {
      const field = metadata.fields.find((f) => f.key === pk);
      return field?.name ?? pk;
    }),
  );

  for (const col of allColumns) {
    // Skip root fields (already in root INSERT) and PK (already added above)
    if (rootFieldNames.has(col.column)) continue;
    if (pkColNames.has(col.column)) continue;
    childColumns.push(col);
  }

  const childColNames = childColumns.map((c) => quoteIdentifier(c.column));
  const childParams: Array<unknown> = childColumns.map((c) => c.value);
  const childPlaceholders = childColumns.map((_, i) => `$${i + 1}`);

  const childText = `INSERT INTO ${childTableName} (${childColNames.join(", ")}) VALUES (${childPlaceholders.join(", ")}) RETURNING *`;
  const childSql: CompiledSql = { text: childText, params: childParams };

  return { rootSql, childSql, childPkParamIndices, partition };
};

/**
 * Compile a multi-table UPDATE for a joined inheritance child entity.
 *
 * Returns up to two SQL statements:
 * 1. rootSql: UPDATE root table (root fields, optimistic lock on root)
 * 2. childSql: UPDATE child table (child fields)
 *
 * Either may be null if there are no fields to update on that table.
 * The executor must run both within a transaction.
 * Version/optimistic lock check is on the root table.
 */
export const compileJoinedUpdate = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  namespace?: string | null,
  amphora?: IAmphora,
): JoinedUpdateSql | null => {
  const partition = partitionJoinedFields(metadata);
  if (!partition) return null;

  const discriminatorColName = getDiscriminatorColumnName(metadata);

  // Dehydrate the full entity in "update" mode (skips PKs, CreateDate, readonly)
  const allColumns = dehydrateEntity(entity, metadata, "update", amphora);

  // Partition the dehydrated columns into root vs child
  const rootFieldNames = new Set(partition.rootFields.map((f) => f.name));
  const rootUpdateColumns: Array<{ column: string; value: unknown }> = [];
  const childUpdateColumns: Array<{ column: string; value: unknown }> = [];

  for (const col of allColumns) {
    // Skip discriminator — it is read-only after creation
    if (discriminatorColName && col.column === discriminatorColName) continue;

    if (rootFieldNames.has(col.column)) {
      rootUpdateColumns.push(col);
    } else {
      childUpdateColumns.push(col);
    }
  }

  // ─── Root table UPDATE ───
  let rootSql: CompiledSql | null = null;
  if (rootUpdateColumns.length > 0) {
    const rootResolved = resolveTableName(metadata, namespace);
    const rootTableName = quoteQualifiedName(rootResolved.schema, rootResolved.name);

    const rootParams: Array<unknown> = [];
    const setClauses = rootUpdateColumns.map((c) => {
      rootParams.push(c.value);
      return `${quoteIdentifier(c.column)} = $${rootParams.length}`;
    });

    // PK conditions on root
    const pkConditions = buildPrimaryKeyConditions(entity, metadata, rootParams);

    // Optimistic lock on root (version field)
    const versionField = metadata.fields.find((f) => f.decorator === "Version");
    if (versionField) {
      const currentVersion = (entity as any)[versionField.key];
      rootParams.push(currentVersion - 1);
      pkConditions.push(
        `"t0".${quoteIdentifier(versionField.name)} = $${rootParams.length}`,
      );
    }

    // Discriminator predicate
    const discPredicate = buildDiscriminatorPredicate(metadata, "t0", rootParams);
    if (discPredicate) {
      pkConditions.push(discPredicate);
    }

    const rootText = `UPDATE ${rootTableName} AS "t0" SET ${setClauses.join(", ")} WHERE ${pkConditions.join(" AND ")} RETURNING *`;
    rootSql = { text: rootText, params: rootParams };
  }

  // ─── Child table UPDATE ───
  let childSql: CompiledSql | null = null;
  if (childUpdateColumns.length > 0) {
    const childEntityName = getEntityName(metadata.target, {
      namespace: namespace ?? undefined,
    });
    const childTableName = quoteQualifiedName(
      childEntityName.namespace ?? null,
      childEntityName.name,
    );

    const childParams: Array<unknown> = [];
    const setClauses = childUpdateColumns.map((c) => {
      childParams.push(c.value);
      return `${quoteIdentifier(c.column)} = $${childParams.length}`;
    });

    // PK conditions on child table
    const pkConditions = buildPrimaryKeyConditions(entity, metadata, childParams);

    const childText = `UPDATE ${childTableName} AS "t0" SET ${setClauses.join(", ")} WHERE ${pkConditions.join(" AND ")} RETURNING *`;
    childSql = { text: childText, params: childParams };
  }

  return { rootSql, childSql, partition };
};

const buildPrimaryKeyConditions = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  params: Array<unknown>,
): Array<string> => {
  return metadata.primaryKeys.map((primaryKey) => {
    const field = metadata.fields.find((f) => f.key === primaryKey);
    const colName = field?.name ?? primaryKey;
    params.push((entity as any)[primaryKey]);
    return `"t0".${quoteIdentifier(colName)} = $${params.length}`;
  });
};
