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
import { resolveTableName } from "./resolve-table-name.js";
import {
  buildDiscriminatorPredicateUnqualified,
  getDiscriminatorColumnName,
} from "./compile-helpers.js";

export type JoinedPartialUpdateSql = {
  /** Always present -- either an UPDATE with changed root columns or a SELECT to retrieve root values. */
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
 *
 * MySQL has no RETURNING clause. The executor must follow up with a SELECT-back
 * using compileSelectByPk to retrieve the hydrated row.
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
    // Skip discriminator column -- it is read-only after creation
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
    params.push(coerceWriteValue(transformed, field?.type ?? null));
    setClauses.push(`${quoteIdentifier(colName)} = ?`);
  }

  // Always add Version (bumped) -- unless already in changed dict
  const versionField = metadata.fields.find((f) => f.decorator === "Version");
  if (versionField && !(versionField.name in changed)) {
    params.push(coerceWriteValue((entity as any)[versionField.key], versionField.type));
    setClauses.push(`${quoteIdentifier(versionField.name)} = ?`);
  }

  // Always add UpdateDate -- unless already in changed dict
  const updateDateField = metadata.fields.find((f) => f.decorator === "UpdateDate");
  if (updateDateField && !(updateDateField.name in changed)) {
    params.push(
      coerceWriteValue((entity as any)[updateDateField.key], updateDateField.type),
    );
    setClauses.push(`${quoteIdentifier(updateDateField.name)} = ?`);
  }

  // WHERE: PK + old version (unqualified column names)
  const conditions: Array<string> = [];
  for (const primaryKey of metadata.primaryKeys) {
    const field = metadata.fields.find((f) => f.key === primaryKey);
    const colName = field?.name ?? primaryKey;
    params.push((entity as any)[primaryKey]);
    conditions.push(`${quoteIdentifier(colName)} = ?`);
  }

  if (versionField) {
    const currentVersion = (entity as any)[versionField.key];
    params.push(currentVersion - 1);
    conditions.push(`${quoteIdentifier(versionField.name)} = ?`);
  }

  // Add discriminator predicate (unqualified)
  const discPredicate = buildDiscriminatorPredicateUnqualified(metadata, params);
  if (discPredicate) {
    conditions.push(discPredicate);
  }

  const text = `UPDATE ${tableName} SET ${setClauses.join(", ")} WHERE ${conditions.join(" AND ")}`;

  return { text, params };
};

/**
 * Compile a multi-table partial UPDATE for a joined inheritance child entity.
 *
 * MySQL has no RETURNING clause. The executor must follow up with SELECT-back queries.
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
    if (discriminatorColName && colName === discriminatorColName) continue;

    if (rootFieldNames.has(colName)) {
      rootChanged[colName] = value;
    } else {
      childChanged[colName] = value;
    }
  }

  // --- Root table UPDATE ---
  const rootParams: Array<unknown> = [];
  const rootSetClauses: Array<string> = [];

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
    rootParams.push(coerceWriteValue(transformed, field?.type ?? null));
    rootSetClauses.push(`${quoteIdentifier(colName)} = ?`);
  }

  const versionField = metadata.fields.find((f) => f.decorator === "Version");
  if (versionField && !(versionField.name in rootChanged)) {
    rootParams.push(
      coerceWriteValue((entity as any)[versionField.key], versionField.type),
    );
    rootSetClauses.push(`${quoteIdentifier(versionField.name)} = ?`);
  }

  const updateDateField = metadata.fields.find((f) => f.decorator === "UpdateDate");
  if (updateDateField && !(updateDateField.name in rootChanged)) {
    rootParams.push(
      coerceWriteValue((entity as any)[updateDateField.key], updateDateField.type),
    );
    rootSetClauses.push(`${quoteIdentifier(updateDateField.name)} = ?`);
  }

  const rootResolved = resolveTableName(metadata, namespace);
  const rootTableName = quoteQualifiedName(rootResolved.schema, rootResolved.name);

  // When a version field exists, the root UPDATE must always be issued (even if
  // only child columns changed) so the optimistic lock check fires on the root row.
  const mustUpdateRoot = rootSetClauses.length > 0 || !!versionField;

  let rootSql: CompiledSql;
  if (mustUpdateRoot) {
    const rootConditions: Array<string> = [];
    for (const primaryKey of metadata.primaryKeys) {
      const field = metadata.fields.find((f) => f.key === primaryKey);
      const colName = field?.name ?? primaryKey;
      rootParams.push((entity as any)[primaryKey]);
      rootConditions.push(`${quoteIdentifier(colName)} = ?`);
    }

    if (versionField) {
      const currentVersion = (entity as any)[versionField.key];
      rootParams.push(currentVersion - 1);
      rootConditions.push(`${quoteIdentifier(versionField.name)} = ?`);
    }

    const discPredicate = buildDiscriminatorPredicateUnqualified(metadata, rootParams);
    if (discPredicate) {
      rootConditions.push(discPredicate);
    }

    const rootText = `UPDATE ${rootTableName} SET ${rootSetClauses.join(", ")} WHERE ${rootConditions.join(" AND ")}`;
    rootSql = { text: rootText, params: rootParams };
  } else {
    const rootConditions: Array<string> = [];
    for (const primaryKey of metadata.primaryKeys) {
      const field = metadata.fields.find((f) => f.key === primaryKey);
      const colName = field?.name ?? primaryKey;
      rootParams.push((entity as any)[primaryKey]);
      rootConditions.push(`${quoteIdentifier(colName)} = ?`);
    }

    const rootText = `SELECT * FROM ${rootTableName} WHERE ${rootConditions.join(" AND ")}`;
    rootSql = { text: rootText, params: rootParams };
  }

  // --- Child table UPDATE or SELECT ---
  const childEntityName = getEntityName(metadata.target, {
    namespace: namespace ?? undefined,
  });
  const childTableName = quoteQualifiedName(namespace ?? null, childEntityName.name);

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
      childParams.push(coerceWriteValue(transformed, field?.type ?? null));
      childSetClauses.push(`${quoteIdentifier(colName)} = ?`);
    }

    const childConditions: Array<string> = [];
    for (const primaryKey of metadata.primaryKeys) {
      const field = metadata.fields.find((f) => f.key === primaryKey);
      const colName = field?.name ?? primaryKey;
      childParams.push((entity as any)[primaryKey]);
      childConditions.push(`${quoteIdentifier(colName)} = ?`);
    }

    const childText = `UPDATE ${childTableName} SET ${childSetClauses.join(", ")} WHERE ${childConditions.join(" AND ")}`;
    childSql = { text: childText, params: childParams };
  } else {
    const childParams: Array<unknown> = [];
    const childConditions: Array<string> = [];
    for (const primaryKey of metadata.primaryKeys) {
      const field = metadata.fields.find((f) => f.key === primaryKey);
      const colName = field?.name ?? primaryKey;
      childParams.push((entity as any)[primaryKey]);
      childConditions.push(`${quoteIdentifier(colName)} = ?`);
    }

    const childText = `SELECT * FROM ${childTableName} WHERE ${childConditions.join(" AND ")}`;
    childSql = { text: childText, params: childParams };
  }

  return { rootSql, childSql, rootIsUpdate: mustUpdateRoot };
};
