import type { IAmphora } from "@lindorm/amphora";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { DehydrateMode } from "../../../../entity/utils/default-dehydrate-entity.js";
import { encryptFieldValue } from "../../../../entity/utils/encrypt-field-value.js";
import { resolveJoinKeyValue } from "../../../../entity/utils/resolve-join-key-value.js";
import { getSkipKeys } from "../../../../utils/sql/get-skip-keys.js";
import { coerceWriteValue } from "./coerce-value.js";

export type DehydratedColumn = {
  column: string;
  value: unknown;
};

export { type DehydrateMode };

export const dehydrateEntity = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  mode: DehydrateMode,
  amphora?: IAmphora,
): Array<DehydratedColumn> => {
  const columns: Array<DehydratedColumn> = [];
  const skipKeys = getSkipKeys(metadata, mode);
  const handledKeys = new Set<string>();

  for (const field of metadata.fields) {
    if (skipKeys.has(field.key)) continue;

    let value: unknown;

    if (field.embedded) {
      // Embedded fields use dotted keys (e.g., "address.city") but after hydration
      // the entity has nested objects: entity.address.city
      const parentObj = (entity as any)[field.embedded.parentKey];
      // Assumes exactly 2-level dotted key (parentKey.childKey)
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
    columns.push({ column: field.name, value: coerceWriteValue(value, field.type) });
    handledKeys.add(field.key);
  }

  for (const relation of metadata.relations) {
    if (!relation.joinKeys) continue;
    if (relation.type === "ManyToMany") continue;

    // joinKeys stores column names (post-naming-strategy), not property names
    for (const [localKey, foreignKey] of Object.entries(relation.joinKeys)) {
      if (handledKeys.has(localKey)) continue;

      const value = resolveJoinKeyValue(entity, relation, localKey, foreignKey);

      columns.push({ column: localKey, value: coerceWriteValue(value ?? null, null) });
      handledKeys.add(localKey);
    }
  }

  return columns;
};
