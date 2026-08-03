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
 */
export const validateElementFields = (
  targetName: string,
  listKey: string,
  embeddableName: string,
  fields: Array<MetaField>,
): void => {
  for (const field of fields) {
    if (!field.encrypted) continue;

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
};
