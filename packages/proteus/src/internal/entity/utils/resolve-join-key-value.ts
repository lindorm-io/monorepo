import { isObjectLike } from "@lindorm/is";
import type { EntityMetadata, MetaRelation } from "../types/metadata.js";
import { isLazyRelation } from "./lazy-relation.js";
import { resolvePropertyKey } from "./resolve-property-key.js";

/**
 * Resolves a FK column value from an entity using a fallback chain:
 * 1. Check the bare FK *property* on the entity (e.g., entity.authorId). Under
 *    the snake strategy the joinKey `localKey` is the column name (author_id),
 *    so we map it back to the property key via `metadata`.
 * 2. Check the raw column key as a property (covers callers that set it directly).
 * 3. Fall back to entity[relation.key][foreignKey] (e.g., entity.author.id)
 *
 * Used by defaultHydrateEntity, defaultDehydrateEntity, and diffColumns.
 */
export const resolveJoinKeyValue = (
  entity: any,
  relation: MetaRelation,
  localKey: string,
  foreignKey: string,
  metadata?: EntityMetadata,
): unknown => {
  const propertyKey = metadata ? resolvePropertyKey(metadata, localKey) : localKey;

  const bare = entity[propertyKey];
  if (bare !== undefined) return bare;

  if (propertyKey !== localKey) {
    const byColumn = entity[localKey];
    if (byColumn !== undefined) return byColumn;
  }

  const related = entity[relation.key];
  if (isLazyRelation(related)) return null;
  if (isObjectLike(related)) {
    return related[foreignKey] ?? null;
  }

  return null;
};
