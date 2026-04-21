import type { IEntity } from "../../../interfaces/index.js";
import { ProteusRepositoryError } from "../../../errors/ProteusRepositoryError.js";
import type { MetaRelation } from "../../entity/types/metadata.js";

export const buildRelationFilter = (
  relation: MetaRelation,
  entity: IEntity,
): Record<string, unknown> => {
  if (!relation.findKeys) {
    throw new ProteusRepositoryError(
      `Cannot build relation filter: findKeys is null for relation "${relation.key}" on "${relation.type}"`,
      { debug: { relationKey: relation.key, relationType: relation.type } },
    );
  }

  const filter: Record<string, unknown> = {};
  for (const [foreignKey, localKey] of Object.entries(relation.findKeys)) {
    filter[foreignKey] = (entity as any)[localKey] ?? null;
  }
  return filter;
};
