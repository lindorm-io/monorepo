import type { IAmphora } from "@lindorm/amphora";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { DehydrateMode } from "../../../../entity/utils/default-dehydrate-entity.js";
import { dehydrateFieldValue } from "../../../../entity/utils/dehydrate-field-value.js";
import { resolveJoinKeyValue } from "../../../../entity/utils/resolve-join-key-value.js";
import { dehydrateTypedJson } from "../../../../entity/utils/typed-json.js";
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

    // @TypedJson owns its own write order — transform, SPLIT, then seal EACH
    // half — so it runs before the generic transform/encrypt below.
    if (field.typedJson) {
      const { data, meta } = dehydrateTypedJson(
        field,
        value,
        amphora,
        metadata.entity.name,
      );
      columns.push({ column: field.name, value: coerceWriteValue(data, field.type) });
      columns.push({ column: field.typedJson.column, value: meta });
      handledKeys.add(field.name);
      handledKeys.add(field.typedJson.column);
      continue;
    }

    columns.push({
      column: field.name,
      value: dehydrateFieldValue(value, field, metadata.entity.name, {
        amphora,
        coerce: (v) => coerceWriteValue(v, field.type),
      }),
    });
    handledKeys.add(field.name);
  }

  for (const relation of metadata.relations) {
    if (!relation.joinKeys) continue;
    if (relation.type === "ManyToMany") continue;

    // joinKeys stores column names (post-naming-strategy), not property names
    for (const [localKey, foreignKey] of Object.entries(relation.joinKeys)) {
      if (handledKeys.has(localKey)) continue;

      const value = resolveJoinKeyValue(entity, relation, localKey, foreignKey, metadata);

      columns.push({ column: localKey, value: coerceWriteValue(value ?? null, null) });
      handledKeys.add(localKey);
    }
  }

  return columns;
};
