import { EntityMetadataError } from "../errors/EntityMetadataError.js";
import type { MetaField, MetaIndex } from "../types/metadata.js";

export const validateIndexes = (
  targetName: string,
  indexes: Array<MetaIndex>,
  fields: Array<MetaField>,
): void => {
  const seenNames = new Set<string>();
  const seenKeySignatures = new Set<string>();
  const fieldKeys = new Set(fields.map((f) => f.key));

  for (const index of indexes) {
    if (!index.keys.length) {
      throw new EntityMetadataError("Index fields not found", {
        debug: { target: targetName, index: index.name },
      });
    }

    if (index.name !== null) {
      if (seenNames.has(index.name)) {
        throw new EntityMetadataError("Duplicate index name", {
          debug: { target: targetName, index: index.name },
        });
      }
      seenNames.add(index.name);
    }

    for (const { key } of index.keys) {
      if (fieldKeys.has(key)) continue;
      throw new EntityMetadataError("Index field not found", {
        debug: { target: targetName, key, index: index.name },
      });
    }

    const signature = index.keys
      .map((k) => `${k.key}:${k.direction}`)
      .sort()
      .join(",");

    if (seenKeySignatures.has(signature)) {
      throw new EntityMetadataError("Duplicate index keys", {
        debug: { target: targetName, index: index.name },
      });
    }
    seenKeySignatures.add(signature);
  }
};
