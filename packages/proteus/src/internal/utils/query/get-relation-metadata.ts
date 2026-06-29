import { ProteusError } from "../../../errors/index.js";
import type { EntityMetadata, MetaRelation } from "../../entity/types/metadata.js";
import { getForeignMetadata } from "../../entity/metadata/foreign-metadata.js";

export const getRelationMetadata = (relation: MetaRelation): EntityMetadata =>
  getForeignMetadata(relation, relation.foreignConstructor());

export const findRelationByKey = (
  metadata: EntityMetadata,
  relationKey: string,
): MetaRelation => {
  const relation = metadata.relations.find((r) => r.key === relationKey);
  if (!relation) {
    throw new ProteusError(
      `Relation "${relationKey}" not found on entity "${metadata.entity.name}"`,
      {
        code: "unknown_relation",
        title: "Unknown Relation",
        details: "The requested relation is not declared on this entity.",
        data: { relation: relationKey, entityName: metadata.entity.name },
      },
    );
  }
  return relation;
};
