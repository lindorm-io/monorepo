import type { IAmphora } from "@lindorm/amphora";
import type { Dict } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata } from "../types/metadata.js";
import { encryptFieldValue } from "./encrypt-field-value.js";
import { resolveJoinKeyValue } from "./resolve-join-key-value.js";

export type DehydrateMode = "insert" | "update";

/**
 * Convert an entity instance into a flat Dict keyed by column name for persistence.
 *
 * - Mode "insert": skip generated increment fields (DB handles auto-increment)
 * - Mode "update": skip increments + PKs + CreateDate + readonly user fields
 * - FK columns are extracted via resolveJoinKeyValue (two-step fallback)
 * - No driver-specific coercion — driver wraps this with its own coercion layer
 */
export const defaultDehydrateEntity = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  mode: DehydrateMode,
  amphora?: IAmphora,
): Dict => {
  const result: Dict = {};
  const skipKeys = getSkipKeys(metadata, mode);
  const handledKeys = new Set<string>();

  for (const field of metadata.fields) {
    if (skipKeys.has(field.key)) continue;

    let value: unknown;
    if (field.embedded) {
      // Embedded field: read from nested object (entity.address?.street)
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
      value = encryptFieldValue(
        value,
        field.encrypted.predicate,
        amphora,
        field.key,
        metadata.entity.name,
      );
    }
    result[field.name] = value;
    handledKeys.add(field.key);
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

  return result;
};

const getSkipKeys = (metadata: EntityMetadata, mode: DehydrateMode): Set<string> => {
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
      if (field.decorator === "Field" && field.readonly) {
        skip.add(field.key);
      }
    }
  }

  return skip;
};
