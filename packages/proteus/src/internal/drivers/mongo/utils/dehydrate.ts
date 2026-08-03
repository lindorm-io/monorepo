import type { IAmphora } from "@lindorm/amphora";
import type { Dict } from "@lindorm/types";
import type { Document } from "mongodb";
import type { IEntity } from "../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { dehydrateFieldValue } from "../../../entity/utils/dehydrate-field-value.js";
import { resolveJoinKeyValue } from "../../../entity/utils/resolve-join-key-value.js";
import { serialiseArray } from "../../../entity/utils/serialise.js";
import { dehydrateTypedJson } from "../../../entity/utils/typed-json.js";
import { buildCompoundId } from "./build-compound-id.js";

/**
 * Convert an entity instance into a MongoDB document for persistence.
 *
 * - PK fields map to _id (single PK: value directly; composite: sorted compound object)
 * - UUID/string fields: passthrough
 * - Decimal fields: stored as string
 * - Date fields: native JS Date (BSON Date)
 * - JSON/array fields: native BSON passthrough
 * - @TypedJson fields: JSON-safe data in the data column + stringified type
 *   metadata in the sidecar column (BSON would otherwise flatten a nested
 *   Buffer to Binary and drop `undefined` keys)
 * - Embedded entities: flatten to dot-notation (e.g. address.city)
 * - Nullable fields: explicit null, never undefined
 * - Computed fields: skipped
 * - FK columns from owning relations: extracted via resolveJoinKeyValue
 * - Discriminator stamp for single-table inheritance
 */
export const dehydrateEntity = <E extends IEntity>(
  entity: E,
  metadata: EntityMetadata,
  amphora?: IAmphora,
): Document => {
  const doc: Dict = {};
  const handledKeys = new Set<string>();
  const pkSet = new Set(metadata.primaryKeys);
  const pkValues: Record<string, unknown> = {};

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
    // half — so it runs before the generic transform/encrypt below. A typed-json
    // field is never a PK (an @Encrypted PK is rejected at load, and JsonKit
    // splitting an id is meaningless), so it writes straight to the document.
    if (field.typedJson) {
      const { data, meta } = dehydrateTypedJson(
        field,
        value,
        amphora,
        metadata.entity.name,
      );
      doc[field.name] = data;
      doc[field.typedJson.column] = meta;
      handledKeys.add(field.name);
      handledKeys.add(field.typedJson.column);
      continue;
    }

    // Typed array (@Field("array", { arrayType })): serialise each element to a
    // storage-safe primitive so BSON does not demote bigint to a lossy Long —
    // bigint → decimal string, Date → ISO string; deserialise restores both.
    value = dehydrateFieldValue(value, field, metadata.entity.name, {
      amphora,
      coerce: (v) =>
        v != null && field.type === "array" && field.arrayType
          ? serialiseArray(v, field.arrayType, field.mode)
          : v,
    });

    // Ensure nullable fields store explicit null, never undefined
    if (value === undefined) {
      value = null;
    }

    if (pkSet.has(field.key)) {
      pkValues[field.key] = value;
    } else {
      // Use the metadata name (DB column name) for non-PK fields
      doc[field.name] = value;
    }

    // A document is keyed by COLUMN name, and so is `joinKeys` — tracking the
    // property key here made the FK loop below miss a declared FK field under a
    // renaming strategy and overwrite the value it had just written with null.
    handledKeys.add(field.name);
  }

  // Extract FK columns from owning relations
  for (const relation of metadata.relations) {
    if (!relation.joinKeys) continue;
    if (relation.type === "ManyToMany") continue;

    for (const [localKey, foreignKey] of Object.entries(relation.joinKeys)) {
      if (handledKeys.has(localKey)) continue;

      doc[localKey] =
        resolveJoinKeyValue(entity, relation, localKey, foreignKey, metadata) ?? null;
      handledKeys.add(localKey);
    }
  }

  // Stamp discriminator value for single-table inheritance children
  if (metadata.inheritance?.discriminatorValue != null) {
    const discField = metadata.inheritance.discriminatorField;
    const field = metadata.fields.find((f) => f.key === discField);
    const mongoField = field?.name ?? discField;
    doc[mongoField] = metadata.inheritance.discriminatorValue;
  }

  // Build _id from PK values
  doc._id = buildCompoundId(metadata.primaryKeys, pkValues);

  return doc;
};
