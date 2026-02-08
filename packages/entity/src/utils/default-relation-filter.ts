import { Dict } from "@lindorm/types";
import { EntityKitError } from "../errors";
import { IEntity } from "../interfaces";
import { MetaRelation } from "../types";

export const defaultRelationFilter = (relation: MetaRelation, entity: IEntity): Dict => {
  if (!relation.findKeys) {
    throw new EntityKitError("Cannot build relation filter without findKeys", {
      debug: { relation: relation.key, type: relation.type },
    });
  }

  const filter: Dict = {};

  for (const [foreignKey, localKey] of Object.entries(relation.findKeys)) {
    filter[foreignKey] = (entity as any)[localKey] ?? null;
  }

  return filter;
};
