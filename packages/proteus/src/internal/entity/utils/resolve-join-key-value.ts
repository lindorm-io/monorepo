import { isObjectLike } from "@lindorm/is";
import type { MetaRelation } from "../types/metadata.js";
import { isLazyRelation } from "./lazy-relation.js";

/**
 * Resolves a FK column value from an entity using a two-step fallback:
 * 1. Check the bare FK field on entity (e.g., entity.authorId)
 * 2. Fall back to entity[relation.key][foreignKey] (e.g., entity.author.id)
 *
 * Used by defaultHydrateEntity, defaultDehydrateEntity, and diffColumns.
 */
export const resolveJoinKeyValue = (
  entity: any,
  relation: MetaRelation,
  localKey: string,
  foreignKey: string,
): unknown => {
  const bare = entity[localKey];
  if (bare !== undefined) return bare;

  const related = entity[relation.key];
  if (isLazyRelation(related)) return null;
  if (isObjectLike(related)) {
    return related[foreignKey] ?? null;
  }

  return null;
};
