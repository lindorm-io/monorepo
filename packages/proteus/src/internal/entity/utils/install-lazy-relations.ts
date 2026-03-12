import type { IEntity } from "../../../interfaces";
import type { EntityMetadata, MetaRelation, QueryScope } from "../types/metadata";
import { LazyRelation } from "./lazy-relation";
import { LazyCollection } from "./lazy-collection";

export type LazyRelationLoader = (
  entity: IEntity,
  relation: MetaRelation,
) => Promise<IEntity | null | Array<IEntity>>;

export type LazyRelationContext = {
  loadRelation: LazyRelationLoader;
};

/**
 * Install lazy thenable proxies on entity properties for relations
 * with loading: "lazy" in the given operation scope.
 *
 * Called after hydration and eager relation loading to wire up deferred loading.
 *
 * For singular relations (ManyToOne, OneToOne):
 * - FK null   → property = null (no thenable)
 * - FK non-null → property = LazyRelation thenable
 *
 * For collection relations (OneToMany, ManyToMany):
 * - Always install LazyCollection thenable (empty result is valid)
 *
 * Skips relations where data was already provided (e.g. user explicitly
 * requested via FindOptions.relations and the data was set by the eager
 * include pipeline).
 *
 * The `loadRelation` callback is driver-provided and handles all relation
 * types, including ManyToMany join table queries.
 */
export const installLazyRelations = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  ctx: LazyRelationContext,
  operationScope: QueryScope,
): void => {
  for (const relation of metadata.relations) {
    if (relation.options.loading[operationScope] !== "lazy") continue;

    // Already loaded (eager include, explicit request) — skip
    const existing = (entity as any)[relation.key];
    if (existing !== undefined) continue;

    const isCol = relation.type === "OneToMany" || relation.type === "ManyToMany";

    if (isCol) {
      (entity as any)[relation.key] = new LazyCollection(
        entity,
        relation.key,
        () => ctx.loadRelation(entity, relation) as Promise<Array<IEntity>>,
      );
    } else {
      if (isFkNull(entity, relation)) {
        (entity as any)[relation.key] = null;
      } else {
        (entity as any)[relation.key] = new LazyRelation(
          entity,
          relation.key,
          () => ctx.loadRelation(entity, relation) as Promise<IEntity | null>,
        );
      }
    }
  }
};

/**
 * Check if all FK columns for a singular owning relation are null.
 * For inverse-side relations (no joinKeys on this entity), we cannot
 * know without querying, so return false (install thenable).
 */
const isFkNull = (entity: IEntity, relation: MetaRelation): boolean => {
  if (!relation.joinKeys) return false;

  for (const localKey of Object.keys(relation.joinKeys)) {
    if ((entity as any)[localKey] != null) return false;
  }

  return true;
};
