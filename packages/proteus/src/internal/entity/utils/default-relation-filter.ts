import type { Dict } from "@lindorm/types";
import { EntityManagerError } from "../errors/EntityManagerError.js";
import type { IEntity } from "../../../interfaces/index.js";
import type { MetaRelation } from "../types/metadata.js";

export const defaultRelationFilter = (relation: MetaRelation, entity: IEntity): Dict => {
  if (!relation.findKeys) {
    throw new EntityManagerError("Cannot build relation filter without findKeys", {
      code: "missing_find_keys",
      title: "Missing Find Keys",
      details: `Relation "${relation.key}" of type "${relation.type}" has no findKeys; declare the join keys so the relation filter can be built.`,
      data: { relation: relation.key, type: relation.type },
    });
  }
  const filter: Dict = {};
  for (const [foreignKey, localKey] of Object.entries(relation.findKeys)) {
    filter[foreignKey] = (entity as any)[localKey] ?? null;
  }
  return filter;
};
