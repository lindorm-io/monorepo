import { EntityMetadataError } from "../errors/EntityMetadataError.js";
import type { MetaField, MetaUnique } from "../types/metadata.js";

export const validateUniques = (
  targetName: string,
  uniques: Array<MetaUnique>,
  fields: Array<MetaField>,
): void => {
  for (const unique of uniques) {
    for (const key of unique.keys) {
      if (fields.find((f) => f.key === key)) continue;
      throw new EntityMetadataError("Unique constraint field not found", {
        code: "missing_unique_field",
        title: "Missing Unique Field",
        details: `@Unique("${unique.name}") on "${targetName}" references field "${key}", which has no @Field decorator — add the field or correct the unique constraint key.`,
        debug: { target: targetName, key, unique: unique.name },
      });
    }
  }
};
