import type { MetaField } from "../../../entity/types/metadata";

/**
 * Returns true if the given field maps to a MySQL type that requires a prefix
 * length when used in an index or unique constraint.
 *
 * MySQL cannot index TEXT/BLOB columns without specifying a prefix length.
 * JSON columns cannot be indexed at all (callers handle the warning).
 */
export const requiresIndexPrefix = (field: MetaField | undefined): boolean => {
  if (!field) return false;
  if (field.type === "string" && !field.max) return true;
  if (field.type === "url") return true;
  if (field.type === "text") return true;
  if (field.type === "binary") return true;
  if (field.type === "json" || field.type === "object" || field.type === "array")
    return true;
  return false;
};
