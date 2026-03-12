import type { EntityMetadata, QueryScope } from "#internal/entity/types/metadata";

export const filterHiddenSelections = (
  metadata: EntityMetadata,
  categories: Array<QueryScope>,
  explicitSelect: Array<string> | null,
): Array<string> | null => {
  if (explicitSelect) return explicitSelect;
  const hasHidden = metadata.fields.some((f) =>
    categories.some((cat) => f.hideOn.includes(cat)),
  );
  if (!hasHidden) return null;
  return metadata.fields
    .filter((f) => !categories.some((cat) => f.hideOn.includes(cat)))
    .map((f) => f.key);
};
