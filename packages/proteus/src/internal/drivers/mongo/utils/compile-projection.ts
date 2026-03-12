import type { Document } from "mongodb";
import type { EntityMetadata } from "#internal/entity/types/metadata";

/**
 * Convert Proteus select fields into MongoDB projection.
 * Maps entity field keys to database field names.
 * PK fields are mapped to _id.
 * Returns undefined if no select is specified (return all fields).
 */
export const compileProjection = (
  select: Array<string> | undefined,
  metadata: EntityMetadata,
): Document | undefined => {
  if (!select || select.length === 0) return undefined;

  const pkSet = new Set(metadata.primaryKeys);
  const projection: Record<string, 1> = {};

  for (const fieldKey of select) {
    const field = metadata.fields.find((f) => f.key === fieldKey);
    const mongoField = pkSet.has(fieldKey) ? "_id" : (field?.name ?? fieldKey);
    projection[mongoField] = 1;
  }

  // Always include _id unless explicitly excluded
  if (!projection._id) {
    projection._id = 1;
  }

  return projection;
};
