import type { Sort, Document } from "mongodb";
import type { EntityMetadata } from "../../../entity/types/metadata.js";

/**
 * Resolve the MongoDB field name for a sort key.
 * Single PK maps to _id; composite PK maps to _id.fieldKey.
 */
const resolveSortFieldName = (fieldKey: string, metadata: EntityMetadata): string => {
  const pkSet = new Set(metadata.primaryKeys);
  if (pkSet.has(fieldKey)) {
    return metadata.primaryKeys.length === 1 ? "_id" : `_id.${fieldKey}`;
  }
  const field = metadata.fields.find((f) => f.key === fieldKey);
  return field?.name ?? fieldKey;
};

/**
 * Check if any sorted field is nullable.
 */
const hasNullableField = (
  orderBy: Record<string, "ASC" | "DESC">,
  metadata: EntityMetadata,
): boolean => {
  for (const fieldKey of Object.keys(orderBy)) {
    const field = metadata.fields.find((f) => f.key === fieldKey);
    if (field?.nullable) return true;
  }
  return false;
};

/**
 * Convert Proteus orderBy into MongoDB sort specification.
 * Maps entity field keys to database field names using metadata.
 * PK fields are mapped to _id (single) or _id.fieldKey (composite).
 */
export const compileSort = (
  orderBy: Record<string, "ASC" | "DESC"> | undefined,
  metadata: EntityMetadata,
): Sort | undefined => {
  if (!orderBy || Object.keys(orderBy).length === 0) return undefined;

  const sort: Record<string, 1 | -1> = {};

  for (const [fieldKey, direction] of Object.entries(orderBy)) {
    const mongoField = resolveSortFieldName(fieldKey, metadata);
    sort[mongoField] = direction === "ASC" ? 1 : -1;
  }

  return sort;
};

/**
 * Build aggregation pipeline stages for SQL-standard NULL ordering.
 *
 * SQL standard: NULLS LAST for ASC, NULLS FIRST for DESC.
 * MongoDB default: nulls sort before all values regardless of direction.
 *
 * This adds $addFields + $sort stages to push nulls to the correct position,
 * then removes the helper fields via $project.
 *
 * Returns null if no nullable fields are involved (regular sort suffices).
 */
export const compileNullSafeSort = (
  orderBy: Record<string, "ASC" | "DESC"> | undefined,
  metadata: EntityMetadata,
): Array<Document> | null => {
  if (!orderBy || Object.keys(orderBy).length === 0) return null;
  if (!hasNullableField(orderBy, metadata)) return null;

  const addFields: Record<string, Document> = {};
  const sortSpec: Record<string, 1 | -1> = {};
  const projectRemove: Record<string, 0> = {};

  for (const [fieldKey, direction] of Object.entries(orderBy)) {
    const mongoField = resolveSortFieldName(fieldKey, metadata);
    const field = metadata.fields.find((f) => f.key === fieldKey);

    if (field?.nullable) {
      // For ASC: nulls last → __null_flag = 1 for null, 0 otherwise; sort flag ASC
      // For DESC: nulls first → __null_flag = 0 for null, 1 otherwise; sort flag ASC
      // This pushes nulls to the desired end in both cases.
      // Use $eq null instead of $ifNull to avoid treating 0, false, "" as null.
      const flagField = `__nullSort_${fieldKey}`;

      if (direction === "ASC") {
        // NULLS LAST: flag=1 for null (sorts after 0)
        addFields[flagField] = {
          $cond: [{ $eq: [`$${mongoField}`, null] }, 1, 0],
        };
      } else {
        // NULLS FIRST: flag=0 for null (sorts before 1)
        addFields[flagField] = {
          $cond: [{ $eq: [`$${mongoField}`, null] }, 0, 1],
        };
      }

      sortSpec[flagField] = 1; // Always ascending for the flag
      projectRemove[flagField] = 0;
    }

    sortSpec[mongoField] = direction === "ASC" ? 1 : -1;
  }

  return [{ $addFields: addFields }, { $sort: sortSpec }, { $project: projectRemove }];
};
