import { isObjectLike } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata, MetaRelation, QueryScope } from "../types/metadata.js";
import { getSnapshot, storeSnapshot } from "./snapshot-store.js";

/**
 * Populate relation properties on an already-hydrated entity based on load strategy.
 *
 * | Strategy | Behavior |
 * |----------|----------|
 * | "eager"  | Assign relation data when provided; default null/[] if absent. |
 * | "ignore" | Leave property undefined. FK columns already on entity. |
 * | "lazy"   | Leave property undefined. installLazyRelations() wires up thenables. |
 *
 * If data IS provided for an ignore/lazy relation (e.g., user explicitly requested it
 * via FindOptions.relations), it is set directly regardless of strategy.
 *
 * Every related entity assigned via eager loading gets a snapshot stored
 * (so it can be independently diff-updated).
 */
export const hydrateRelations = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  relationData: Dict,
  operationScope: QueryScope = "multiple",
): void => {
  for (const relation of metadata.relations) {
    const data = relationData[relation.key];

    if (data === undefined) {
      // No data provided — check strategy
      if (relation.options.loading[operationScope] === "eager") {
        // Eager but no data — set default empty value
        (entity as any)[relation.key] = isCollection(relation) ? [] : null;
      }
      // Ignore/lazy: leave property undefined
      continue;
    }

    // Data is provided — assign regardless of strategy
    (entity as any)[relation.key] = data;

    // Store snapshots for related entities loaded from DB
    if (data != null) {
      if (Array.isArray(data)) {
        for (const item of data) {
          if (isObjectLike(item)) {
            storeSnapshotForRelated(item);
          }
        }
      } else if (isObjectLike(data)) {
        storeSnapshotForRelated(data);
      }
    }
  }
};

const isCollection = (relation: MetaRelation): boolean => {
  return relation.type === "OneToMany" || relation.type === "ManyToMany";
};

const storeSnapshotForRelated = (entity: object): void => {
  // If entity was already hydrated via defaultHydrateEntity, it already has a correct
  // metadata-driven snapshot — don't overwrite it with a heuristic one
  if (getSnapshot(entity)) return;

  // Fallback for manually-provided relation data: build snapshot from enumerable properties
  const dict: Dict = {};
  for (const [key, value] of Object.entries(entity)) {
    if (value === null) {
      dict[key] = value;
    } else if (value === undefined) {
      // skip
    } else if (value instanceof Date) {
      dict[key] = value;
    } else if (Buffer.isBuffer(value)) {
      dict[key] = value;
    } else if (typeof value !== "object") {
      // Primitives: string, number, boolean, bigint
      dict[key] = value;
    }
    // Skip relation properties (objects/arrays) — they aren't columns
  }
  storeSnapshot(entity, dict);
};
