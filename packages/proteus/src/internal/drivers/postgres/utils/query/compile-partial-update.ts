import type { IAmphora } from "@lindorm/amphora";
import type { Dict } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { encryptFieldValue } from "../../../../entity/utils/encrypt-field-value.js";
import { getEntityName } from "../../../../entity/utils/get-entity-name.js";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier.js";
import { coerceWriteValue } from "./coerce-value.js";
import type { CompiledSql } from "./compiled-sql.js";
import { partitionJoinedFields } from "./partition-joined-fields.js";
import { buildDiscriminatorPredicate, resolveTableName } from "./resolve-table-name.js";

export type JoinedPartialUpdateSql = {
  /** Always present — either an UPDATE with changed root columns or a SELECT to retrieve root values. */
  rootSql: CompiledSql;
  /** UPDATE for child-only changed columns, or null if no child columns changed. */
  childSql: CompiledSql | null;
  /** True when rootSql is an UPDATE (has SET clauses); false when it's a read-only SELECT. */
  rootIsUpdate: boolean;
};

/**
 * Compile a partial UPDATE with only changed columns from a diff result.
 *
 * SET clause: changed user-data columns + Version (bumped) + UpdateDate.
 * WHERE clause: PK + old version (version - 1) for optimistic locking.
 * RETURNING *: hydrated result becomes the new snapshot.
 *
 * @param entity - the prepared entity (post-copy, post-bump)
 * @param metadata - entity metadata
 * @param changed - Dict of { columnName: value } from diffColumns
 * @param namespace - optional schema namespace
 */
export const compilePartialUpdate = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  changed: Dict,
  namespace?: string | null,
  amphora?: IAmphora,
): CompiledSql => {
  const resolved = resolveTableName(metadata, namespace);
  const tableName = quoteQualifiedName(resolved.schema, resolved.name);

  const params: Array<unknown> = [];
  const setClauses: Array<string> = [];

  // Resolve discriminator column name to exclude from SET (read-only after creation)
  const discriminatorColName = getDiscriminatorColumnName(metadata);

  // Add changed columns (apply transform.to() for fields with transforms)
  for (const [colName, value] of Object.entries(changed)) {
    // Skip discriminator column — it is read-only after creation
    if (discriminatorColName && colName === discriminatorColName) continue;

    const field = metadata.fields.find((f) => f.name === colName);
    let transformed = field?.transform ? field.transform.to(value) : value;
    if (transformed != null && field?.encrypted && amphora) {
      transformed = encryptFieldValue(
        transformed,
        field.encrypted.predicate,
        amphora,
        field.key,
        metadata.entity.name,
      );
    }
    params.push(coerceWriteValue(transformed));
    setClauses.push(`${quoteIdentifier(colName)} = $${params.length}`);
  }

  // Always add Version (bumped) — unless already in changed dict
  const versionField = metadata.fields.find((f) => f.decorator === "Version");
  if (versionField && !(versionField.name in changed)) {
    params.push(coerceWriteValue((entity as any)[versionField.key]));
    setClauses.push(`${quoteIdentifier(versionField.name)} = $${params.length}`);
  }

  // Always add UpdateDate — unless already in changed dict
  const updateDateField = metadata.fields.find((f) => f.decorator === "UpdateDate");
  if (updateDateField && !(updateDateField.name in changed)) {
    params.push(coerceWriteValue((entity as any)[updateDateField.key]));
    setClauses.push(`${quoteIdentifier(updateDateField.name)} = $${params.length}`);
  }

  // WHERE: PK + old version
  const conditions: Array<string> = [];
  for (const primaryKey of metadata.primaryKeys) {
    const field = metadata.fields.find((f) => f.key === primaryKey);
    const colName = field?.name ?? primaryKey;
    params.push((entity as any)[primaryKey]);
    conditions.push(`"t0".${quoteIdentifier(colName)} = $${params.length}`);
  }

  if (versionField) {
    const currentVersion = (entity as any)[versionField.key];
    params.push(currentVersion - 1);
    conditions.push(`"t0".${quoteIdentifier(versionField.name)} = $${params.length}`);
  }

  // Add discriminator predicate for single-table inheritance children
  const discPredicate = buildDiscriminatorPredicate(metadata, "t0", params);
  if (discPredicate) {
    conditions.push(discPredicate);
  }

  const text = `UPDATE ${tableName} AS "t0" SET ${setClauses.join(", ")} WHERE ${conditions.join(" AND ")} RETURNING *`;

  return { text, params };
};

/**
 * Compile a multi-table partial UPDATE for a joined inheritance child entity.
 *
 * Splits the changed Dict into root-table vs child-table columns using
 * partitionJoinedFields, then produces:
 *   1. rootSql: UPDATE root table with root-only changed columns + Version + UpdateDate,
 *      WHERE PK + old version + discriminator predicate (optimistic lock on root).
 *      If no root columns need updating (no Version/UpdateDate and no root user changes),
 *      a SELECT is emitted instead to retrieve root column values for hydration.
 *   2. childSql: UPDATE child table with child-only changed columns, WHERE PK.
 *      Null if no child columns changed.
 *
 * rootSql is always present. childSql may be null.
 * rootIsUpdate indicates whether rootSql is an UPDATE (true) or SELECT (false).
 *
 * Returns null for non-joined-child entities.
 */
export const compileJoinedPartialUpdate = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  changed: Dict,
  namespace?: string | null,
  amphora?: IAmphora,
): JoinedPartialUpdateSql | null => {
  const partition = partitionJoinedFields(metadata);
  if (!partition) return null;

  const discriminatorColName = getDiscriminatorColumnName(metadata);
  const rootFieldNames = new Set(partition.rootFields.map((f) => f.name));

  // Split changed columns into root vs child buckets
  const rootChanged: Dict = {};
  const childChanged: Dict = {};

  for (const [colName, value] of Object.entries(changed)) {
    // Skip discriminator column — read-only after creation
    if (discriminatorColName && colName === discriminatorColName) continue;

    if (rootFieldNames.has(colName)) {
      rootChanged[colName] = value;
    } else {
      childChanged[colName] = value;
    }
  }

  // ─── Root table UPDATE ───
  // Root always gets Version + UpdateDate even if no user columns changed
  const rootParams: Array<unknown> = [];
  const rootSetClauses: Array<string> = [];

  // Add root changed columns (apply transform.to() for fields with transforms)
  for (const [colName, value] of Object.entries(rootChanged)) {
    const field = metadata.fields.find((f) => f.name === colName);
    let transformed = field?.transform ? field.transform.to(value) : value;
    if (transformed != null && field?.encrypted && amphora) {
      transformed = encryptFieldValue(
        transformed,
        field.encrypted.predicate,
        amphora,
        field.key,
        metadata.entity.name,
      );
    }
    rootParams.push(coerceWriteValue(transformed));
    rootSetClauses.push(`${quoteIdentifier(colName)} = $${rootParams.length}`);
  }

  // Always add Version (bumped) — unless already in changed dict
  const versionField = metadata.fields.find((f) => f.decorator === "Version");
  if (versionField && !(versionField.name in rootChanged)) {
    rootParams.push(coerceWriteValue((entity as any)[versionField.key]));
    rootSetClauses.push(`${quoteIdentifier(versionField.name)} = $${rootParams.length}`);
  }

  // Always add UpdateDate — unless already in changed dict
  const updateDateField = metadata.fields.find((f) => f.decorator === "UpdateDate");
  if (updateDateField && !(updateDateField.name in rootChanged)) {
    rootParams.push(coerceWriteValue((entity as any)[updateDateField.key]));
    rootSetClauses.push(
      `${quoteIdentifier(updateDateField.name)} = $${rootParams.length}`,
    );
  }

  const rootResolved = resolveTableName(metadata, namespace);
  const rootTableName = quoteQualifiedName(rootResolved.schema, rootResolved.name);

  // When a version field exists, the root UPDATE must always be issued (even if
  // only child columns changed) so the optimistic lock check fires on the root row.
  const mustUpdateRoot = rootSetClauses.length > 0 || !!versionField;

  let rootSql: CompiledSql;
  if (mustUpdateRoot) {
    // Root has columns to update — emit UPDATE ... RETURNING *
    const rootConditions: Array<string> = [];
    for (const primaryKey of metadata.primaryKeys) {
      const field = metadata.fields.find((f) => f.key === primaryKey);
      const colName = field?.name ?? primaryKey;
      rootParams.push((entity as any)[primaryKey]);
      rootConditions.push(`"t0".${quoteIdentifier(colName)} = $${rootParams.length}`);
    }

    if (versionField) {
      const currentVersion = (entity as any)[versionField.key];
      rootParams.push(currentVersion - 1);
      rootConditions.push(
        `"t0".${quoteIdentifier(versionField.name)} = $${rootParams.length}`,
      );
    }

    const discPredicate = buildDiscriminatorPredicate(metadata, "t0", rootParams);
    if (discPredicate) {
      rootConditions.push(discPredicate);
    }

    const rootText = `UPDATE ${rootTableName} AS "t0" SET ${rootSetClauses.join(", ")} WHERE ${rootConditions.join(" AND ")} RETURNING *`;
    rootSql = { text: rootText, params: rootParams };
  } else {
    // No root columns to update (no Version/UpdateDate and no user root changes).
    // Emit a SELECT to retrieve root column values for hydration of the merged row.
    const rootConditions: Array<string> = [];
    for (const primaryKey of metadata.primaryKeys) {
      const field = metadata.fields.find((f) => f.key === primaryKey);
      const colName = field?.name ?? primaryKey;
      rootParams.push((entity as any)[primaryKey]);
      rootConditions.push(`"t0".${quoteIdentifier(colName)} = $${rootParams.length}`);
    }

    const rootText = `SELECT * FROM ${rootTableName} AS "t0" WHERE ${rootConditions.join(" AND ")}`;
    rootSql = { text: rootText, params: rootParams };
  }

  // ─── Child table UPDATE or SELECT ───
  // Always emit a child SQL statement so the merged row contains child-specific columns
  // for hydration, even when no child columns were changed.
  const childEntityName = getEntityName(metadata.target, {
    namespace: namespace ?? undefined,
  });
  const childTableName = quoteQualifiedName(
    childEntityName.namespace ?? null,
    childEntityName.name,
  );

  let childSql: CompiledSql;
  const hasChildChanges = Object.keys(childChanged).length > 0;

  if (hasChildChanges) {
    const childParams: Array<unknown> = [];
    const childSetClauses: Array<string> = [];

    for (const [colName, value] of Object.entries(childChanged)) {
      const field = metadata.fields.find((f) => f.name === colName);
      let transformed = field?.transform ? field.transform.to(value) : value;
      if (transformed != null && field?.encrypted && amphora) {
        transformed = encryptFieldValue(
          transformed,
          field.encrypted.predicate,
          amphora,
          field.key,
          metadata.entity.name,
        );
      }
      childParams.push(coerceWriteValue(transformed));
      childSetClauses.push(`${quoteIdentifier(colName)} = $${childParams.length}`);
    }

    // WHERE: PK only (no version check on child — optimistic lock is on root)
    const childConditions: Array<string> = [];
    for (const primaryKey of metadata.primaryKeys) {
      const field = metadata.fields.find((f) => f.key === primaryKey);
      const colName = field?.name ?? primaryKey;
      childParams.push((entity as any)[primaryKey]);
      childConditions.push(`"t0".${quoteIdentifier(colName)} = $${childParams.length}`);
    }

    const childText = `UPDATE ${childTableName} AS "t0" SET ${childSetClauses.join(", ")} WHERE ${childConditions.join(" AND ")} RETURNING *`;
    childSql = { text: childText, params: childParams };
  } else {
    // No child columns changed — emit a SELECT to retrieve child column values for hydration.
    const childParams: Array<unknown> = [];
    const childConditions: Array<string> = [];
    for (const primaryKey of metadata.primaryKeys) {
      const field = metadata.fields.find((f) => f.key === primaryKey);
      const colName = field?.name ?? primaryKey;
      childParams.push((entity as any)[primaryKey]);
      childConditions.push(`"t0".${quoteIdentifier(colName)} = $${childParams.length}`);
    }

    const childText = `SELECT * FROM ${childTableName} AS "t0" WHERE ${childConditions.join(" AND ")}`;
    childSql = { text: childText, params: childParams };
  }

  return { rootSql, childSql, rootIsUpdate: mustUpdateRoot };
};

/**
 * Get the column name of the discriminator field, if this entity is a
 * single-table inheritance child. Returns null otherwise.
 */
const getDiscriminatorColumnName = (metadata: EntityMetadata): string | null => {
  if (!metadata.inheritance) return null;
  if (metadata.inheritance.discriminatorValue == null) return null;

  const field = metadata.fields.find(
    (f) => f.key === metadata.inheritance!.discriminatorField,
  );
  return field?.name ?? null;
};
