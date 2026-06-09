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
        code: "missing_index_fields",
        title: "Missing Index Fields",
        details: `@Index "${index.name ?? "(unnamed)"}" on "${targetName}" declares no fields — list at least one field key for the index.`,
        debug: { target: targetName, index: index.name },
      });
    }

    if (index.name !== null) {
      if (seenNames.has(index.name)) {
        throw new EntityMetadataError("Duplicate index name", {
          code: "duplicate_index_name",
          title: "Duplicate Index Name",
          details: `Two @Index decorators on "${targetName}" share the name "${index.name}" — give each index a unique name.`,
          debug: { target: targetName, index: index.name },
        });
      }
      seenNames.add(index.name);
    }

    for (const { key } of index.keys) {
      if (fieldKeys.has(key)) continue;
      throw new EntityMetadataError("Index field not found", {
        code: "missing_index_field",
        title: "Missing Index Field",
        details: `@Index "${index.name ?? "(unnamed)"}" on "${targetName}" references field "${key}", which has no @Field decorator — index an existing field key.`,
        debug: { target: targetName, key, index: index.name },
      });
    }

    const signature = index.keys
      .map((k) => `${k.key}:${k.direction}`)
      .sort()
      .join(",");

    if (seenKeySignatures.has(signature)) {
      throw new EntityMetadataError("Duplicate index keys", {
        code: "duplicate_index_keys",
        title: "Duplicate Index Keys",
        details: `Two @Index decorators on "${targetName}" cover the same key set and direction (${signature}) — remove the redundant index.`,
        debug: { target: targetName, index: index.name },
      });
    }
    seenKeySignatures.add(signature);
  }
};
