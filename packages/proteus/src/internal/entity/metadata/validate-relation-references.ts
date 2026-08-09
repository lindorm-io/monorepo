import { EntityMetadataError } from "../errors/EntityMetadataError.js";
import type { EntityMetadata, MetaRelation } from "../types/metadata.js";

/**
 * Reject a `@RelationId` / `@RelationCount` that names a relation the entity
 * does not declare.
 *
 * Every read site resolves the named relation with `relations.find(...)` and
 * skips the entry when it finds nothing, so a typo produced no error and no
 * property — on every driver, silently. A misspelled relation name is never
 * intentional, so it fails once, here.
 *
 * This is the earliest point where both halves are known: the decorators stage
 * a relation KEY, and `buildPrimaryMetadata` runs before relations are
 * resolved, so it has nothing to check the key against.
 */
export const validateRelationReferences = (
  primaryMeta: Omit<EntityMetadata, "relations">,
  relations: Array<MetaRelation>,
): void => {
  const valid = relations.map((relation) => relation.key);
  const targetName = primaryMeta.target.name;

  for (const relationId of primaryMeta.relationIds) {
    if (valid.includes(relationId.relationKey)) continue;

    throw new EntityMetadataError("Relation named by @RelationId not found", {
      code: "unknown_relation_reference",
      title: "Unknown Relation Reference",
      details: `@RelationId on "${relationId.key}" of "${targetName}" names relation "${relationId.relationKey}", which is not declared on this entity — name one of [${valid.join(", ")}].`,
      debug: {
        target: targetName,
        property: relationId.key,
        relation: relationId.relationKey,
      },
    });
  }

  for (const relationCount of primaryMeta.relationCounts) {
    if (valid.includes(relationCount.relationKey)) continue;

    throw new EntityMetadataError("Relation named by @RelationCount not found", {
      code: "unknown_relation_reference",
      title: "Unknown Relation Reference",
      details: `@RelationCount on "${relationCount.key}" of "${targetName}" names relation "${relationCount.relationKey}", which is not declared on this entity — name one of [${valid.join(", ")}].`,
      debug: {
        target: targetName,
        property: relationCount.key,
        relation: relationCount.relationKey,
      },
    });
  }
};
