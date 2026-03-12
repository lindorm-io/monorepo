import { EntityMetadataError } from "../errors/EntityMetadataError";
import type { MetaField, MetaUnique } from "../types/metadata";

export const validateUniques = (
  targetName: string,
  uniques: Array<MetaUnique>,
  fields: Array<MetaField>,
): void => {
  for (const unique of uniques) {
    for (const key of unique.keys) {
      if (fields.find((f) => f.key === key)) continue;
      throw new EntityMetadataError("Unique constraint field not found", {
        debug: { target: targetName, key, unique: unique.name },
      });
    }
  }
};
