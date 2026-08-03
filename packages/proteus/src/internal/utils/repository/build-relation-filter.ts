import type { IEntity } from "../../../interfaces/index.js";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError.js";
import type { EntityMetadata, MetaRelation } from "../../entity/types/metadata.js";
import { resolvePropertyKey } from "../../entity/utils/resolve-property-key.js";

/**
 * Build the criteria that selects an entity's related rows.
 *
 * `findKeys` maps a FOREIGN join column to the LOCAL key its value comes from,
 * and the naming strategy rewrites those columns — so both halves resolve back
 * to property keys here. Criteria are property-keyed everywhere: the SQL and
 * mongo drivers resolve a property key to its column themselves, while the
 * memory and redis drivers match against property-keyed rows with no resolver
 * at all, so a column-keyed criterion there matched nothing, silently.
 */
export const buildRelationFilter = (
  relation: MetaRelation,
  entity: IEntity,
  metadata: EntityMetadata,
  foreignMetadata: EntityMetadata,
): Record<string, unknown> => {
  if (!relation.findKeys) {
    throw new ProteusRepositoryError(
      `Cannot build relation filter: findKeys is null for relation "${relation.key}" on "${relation.type}"`,
      {
        code: "relation_find_keys_missing",
        title: "Relation Find Keys Missing",
        details:
          "This relation has no resolved find keys, so its filter cannot be built; check the relation mapping.",
        debug: { relationKey: relation.key, relationType: relation.type },
      },
    );
  }

  const filter: Record<string, unknown> = {};
  for (const [foreignKey, localKey] of Object.entries(relation.findKeys)) {
    filter[resolvePropertyKey(foreignMetadata.fields, foreignKey)] =
      (entity as any)[resolvePropertyKey(metadata.fields, localKey)] ?? null;
  }
  return filter;
};
