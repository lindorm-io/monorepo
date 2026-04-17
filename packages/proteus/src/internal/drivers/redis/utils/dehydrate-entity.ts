import type { IAmphora } from "@lindorm/amphora";
import type { Dict } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces";
import type { EntityMetadata } from "../../../entity/types/metadata";
import { encryptFieldValue } from "../../../entity/utils/encrypt-field-value";
import { resolveJoinKeyValue } from "../../../entity/utils/resolve-join-key-value";

/**
 * Convert an entity instance into a flat Dict keyed by field key for Redis persistence.
 *
 * - Skips @Computed fields and virtual computed properties (relationIds, relationCounts)
 * - Handles @Embedded fields by reading from nested objects
 * - Applies transform.to() when present
 * - Extracts FK columns from owning relations (non-ManyToMany)
 */
export const dehydrateToRow = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  amphora?: IAmphora,
): Dict => {
  const result: Dict = {};
  const handledKeys = new Set<string>();

  for (const field of metadata.fields) {
    if (field.computed) continue;

    let value: unknown;

    if (field.embedded) {
      const parentObj = (entity as any)[field.embedded.parentKey];
      const nestedKey = field.key.split(".")[1];
      value = parentObj != null ? parentObj[nestedKey] : null;
    } else {
      value = (entity as any)[field.key];
    }

    if (value != null && field.transform) {
      value = field.transform.to(value);
    }

    if (value != null && field.encrypted && amphora) {
      value = encryptFieldValue(value, field.encrypted.predicate, amphora);
    }

    result[field.key] = value;
    handledKeys.add(field.key);
  }

  // Skip virtual computed properties
  for (const ri of metadata.relationIds ?? []) {
    handledKeys.add(ri.key);
  }
  for (const rc of metadata.relationCounts ?? []) {
    handledKeys.add(rc.key);
  }

  for (const relation of metadata.relations) {
    if (!relation.joinKeys) continue;
    if (relation.type === "ManyToMany") continue;

    for (const [localKey, foreignKey] of Object.entries(relation.joinKeys)) {
      if (handledKeys.has(localKey)) continue;

      const value = resolveJoinKeyValue(entity, relation, localKey, foreignKey);
      result[localKey] = value ?? null;
      handledKeys.add(localKey);
    }
  }

  // Stamp discriminator value for single-table inheritance children
  if (metadata.inheritance?.discriminatorValue != null) {
    result[metadata.inheritance.discriminatorField] =
      metadata.inheritance.discriminatorValue;
  }

  return result;
};
