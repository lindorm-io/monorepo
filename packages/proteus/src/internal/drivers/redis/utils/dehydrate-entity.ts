import type { IAmphora } from "@lindorm/amphora";
import type { Dict } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { dehydrateFieldValue } from "../../../entity/utils/dehydrate-field-value.js";
import { resolveJoinKeyValue } from "../../../entity/utils/resolve-join-key-value.js";
import { resolvePropertyKey } from "../../../entity/utils/resolve-property-key.js";
import {
  dehydrateTypedJson,
  typedJsonMetaDictKey,
} from "../../../entity/utils/typed-json.js";

/**
 * Convert an entity instance into a flat Dict keyed by field key for Redis persistence.
 *
 * - Skips @Computed fields, and never writes a virtual @RelationId / @RelationCount
 *   property (neither declares a field, so neither is read in the first place)
 * - Handles @Embedded fields by reading from nested objects
 * - Applies transform.to() when present
 * - Splits @TypedJson fields into JSON-safe data + a sidecar type-metadata entry
 *   (a Redis hash is strings only, so Date/Buffer/BigInt need the sidecar)
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

    // @TypedJson owns its own write order — transform, SPLIT, then seal EACH
    // half — so it runs before the generic transform/encrypt below.
    if (field.typedJson) {
      const { data, meta } = dehydrateTypedJson(
        field,
        value,
        amphora,
        metadata.entity.name,
      );
      result[field.key] = data;
      result[typedJsonMetaDictKey(field.key)] = meta;
      handledKeys.add(field.key);
      continue;
    }

    result[field.key] = dehydrateFieldValue(value, field, metadata.entity.name, {
      amphora,
    });

    handledKeys.add(field.key);
  }

  // A @RelationId / @RelationCount is virtual and never written, but it needs no
  // marking here: neither has a field of its own, and only the field loop above
  // reads a property into the row. Marking them handled instead SUPPRESSED the FK
  // below, because an auto-FK's relationId carries the very property key the FK
  // column is stored under — so a child written through the relation OBJECT
  // stored a null FK and lost its parent.
  for (const relation of metadata.relations) {
    if (!relation.joinKeys) continue;
    if (relation.type === "ManyToMany") continue;

    // The row Dict is keyed by property key throughout; `joinKeys` names
    // physical columns, which diverge under a renaming strategy.
    for (const [localKey, foreignKey] of Object.entries(relation.joinKeys)) {
      const propertyKey = resolvePropertyKey(metadata.fields, localKey);
      if (handledKeys.has(propertyKey)) continue;

      const value = resolveJoinKeyValue(entity, relation, localKey, foreignKey, metadata);
      result[propertyKey] = value ?? null;
      handledKeys.add(propertyKey);
    }
  }

  // Stamp discriminator value for single-table inheritance children
  if (metadata.inheritance?.discriminatorValue != null) {
    result[metadata.inheritance.discriminatorField] =
      metadata.inheritance.discriminatorValue;
  }

  return result;
};
