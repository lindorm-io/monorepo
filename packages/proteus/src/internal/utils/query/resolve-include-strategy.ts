import type { EntityMetadata, RelationStrategy } from "../../entity/types/metadata";

export const resolveIncludeStrategy = (
  relationKey: string,
  metadata: EntityMetadata,
  override?: RelationStrategy,
): RelationStrategy => {
  if (override) return override;

  const relation = metadata.relations.find((r) => r.key === relationKey);
  if (!relation) return "join";

  if (relation.options.strategy) return relation.options.strategy;

  return relation.type === "OneToMany" || relation.type === "ManyToMany"
    ? "query"
    : "join";
};
