import { ProteusError } from "../../../errors/index.js";
import type { EntityMetadata, MetaRelation } from "../../entity/types/metadata.js";
import { getEntityMetadata } from "../../entity/metadata/get-entity-metadata.js";

export const getRelationMetadata = (relation: MetaRelation): EntityMetadata => {
  const foreignConstructor = relation.foreignConstructor();
  return getEntityMetadata(foreignConstructor);
};

export const findRelationByKey = (
  metadata: EntityMetadata,
  relationKey: string,
): MetaRelation => {
  const relation = metadata.relations.find((r) => r.key === relationKey);
  if (!relation) {
    throw new ProteusError(
      `Relation "${relationKey}" not found on entity "${metadata.entity.name}"`,
    );
  }
  return relation;
};
