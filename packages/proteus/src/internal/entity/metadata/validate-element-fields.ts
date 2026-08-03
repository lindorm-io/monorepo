import { EntityMetadataError } from "../errors/EntityMetadataError.js";
import type { MetaField } from "../types/metadata.js";

/**
 * Reject the field modifiers an @EmbeddedList element cannot carry.
 *
 * An @Embeddable is legal in BOTH positions — flattened into the entity's own
 * row by @Embedded, or as the element of a collection table by @EmbeddedList —
 * and the two positions do not have the same capabilities. This runs only for
 * the collection-table position; the flattened position keeps everything.
 *
 * @Encrypted is the one modifier that has to be refused rather than wired up.
 * Proteus defines encryption POLICY over `metadata.fields`, and an element field
 * is deliberately not one of them (it is a column of a different table):
 *
 * - `applyEncryptionDefault` folds the source-level `encryption` KEK into
 *   `metadata.fields` only, so a bare `@Encrypted()` on an element field stays
 *   `{ kryptos: null, condition: null }` — a field that NAMES NO KEY, which is
 *   the exact state `validateEncryptedFields` exists to make fatal.
 * - `source.stageFieldDecorator(Entity, field, Encrypted, …)` addresses a field
 *   as `(entity class, property key)`. It cannot name `token` inside `cards`,
 *   so a sealed element column would be unrotatable through the one documented
 *   per-source override.
 *
 * Sealing the value while leaving the key selection implicit is the hazard the
 * package already legislated against, and closing it properly means a new
 * public addressing surface. So: refuse at metadata build. Encrypt the whole
 * collection as an `@Encrypted @Field("json")` column on the parent, or use
 * @Embedded if a single instance will do.
 *
 * @TypedJson is refused for a different reason, but with the same outcome. It is
 * a TWO-column field — JSON-safe data in the declared column, the JsonKit type
 * metadata in a sidecar beside it — and only the flattened position gets both:
 *
 * - `projectCollectionTables` emits one column per element field, so the sidecar
 *   is never part of the collection table's schema at all.
 * - the element write path (`dehydrateElementValue`) and read path
 *   (`deserialise` per column) have no half to carry it either.
 *
 * The value would therefore round-trip through plain JSON and lose exactly the
 * Date / Buffer / BigInt / `undefined` fidelity the decorator exists to keep —
 * silently. Restoring it is a schema change across every driver, not a missed
 * branch, so the collection-table position refuses it too.
 */
export const validateElementFields = (
  targetName: string,
  listKey: string,
  embeddableName: string,
  fields: Array<MetaField>,
): void => {
  for (const field of fields) {
    if (field.encrypted) {
      throw new EntityMetadataError(
        `@Encrypted cannot be used on @EmbeddedList element field "${field.key}" of "${embeddableName}"`,
        {
          code: "unsupported_element_field_encryption",
          title: "Unsupported Element Field Encryption",
          details: `"${embeddableName}.${field.key}" is @Encrypted, but "${targetName}.${listKey}" stores it as an @EmbeddedList element column, which cannot name an encryption key — the source-level "encryption" default and source.stageFieldDecorator both address entity fields only. Store the collection as an @Encrypted @Field("json") column on "${targetName}", or drop @Encrypted from the element.`,
          debug: {
            target: targetName,
            property: listKey,
            embeddable: embeddableName,
            field: field.key,
          },
        },
      );
    }

    if (field.typedJson) {
      throw new EntityMetadataError(
        `@TypedJson cannot be used on @EmbeddedList element field "${field.key}" of "${embeddableName}"`,
        {
          code: "unsupported_element_field_typed_json",
          title: "Unsupported Element Field Typed Json",
          details: `"${embeddableName}.${field.key}" is @TypedJson, but "${targetName}.${listKey}" stores it as an @EmbeddedList element column, and a collection table carries no sidecar column — the type metadata would be dropped and nested Date/Buffer/BigInt values would come back as plain JSON. Store the collection as a @TypedJson @Field("json") column on "${targetName}", or drop @TypedJson from the element.`,
          debug: {
            target: targetName,
            property: listKey,
            embeddable: embeddableName,
            field: field.key,
            sidecarColumn: field.typedJson.column,
          },
        },
      );
    }
  }
};
