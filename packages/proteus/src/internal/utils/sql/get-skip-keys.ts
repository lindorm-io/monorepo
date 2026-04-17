import type { EntityMetadata } from "../../entity/types/metadata";
import type { DehydrateMode } from "../../entity/utils/default-dehydrate-entity";

export const getSkipKeys = (
  metadata: EntityMetadata,
  mode: DehydrateMode,
): Set<string> => {
  const skip = new Set<string>();

  for (const gen of metadata.generated) {
    if (gen.strategy === "increment" || gen.strategy === "identity") {
      skip.add(gen.key);
    }
  }

  for (const field of metadata.fields) {
    if (field.computed) {
      skip.add(field.key);
    }
  }

  // Virtual computed properties — never persisted
  for (const ri of metadata.relationIds ?? []) {
    skip.add(ri.key);
  }
  for (const rc of metadata.relationCounts ?? []) {
    skip.add(rc.key);
  }

  if (mode === "update") {
    for (const pk of metadata.primaryKeys) {
      skip.add(pk);
    }

    for (const field of metadata.fields) {
      if (field.decorator === "CreateDate") {
        skip.add(field.key);
      }
      // Skip user-facing readonly fields (BF5)
      // Only skip decorator === "Field" with readonly: true
      // Framework fields (Version, UpdateDate, etc.) have different decorators
      // and must still be written on update
      if (field.decorator === "Field" && field.readonly) {
        skip.add(field.key);
      }
    }
  }

  return skip;
};
