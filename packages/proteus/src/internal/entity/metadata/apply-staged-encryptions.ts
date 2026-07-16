import type { EntityMetadata, MetaEncrypted } from "../types/metadata.js";

/**
 * A field-level `@Encrypted` selector staged programmatically on a SINGLE
 * ProteusSource (via `source.stageFieldDecorator`). It overrides whatever the
 * decorator (and the source-level `encryption` default) resolved for that field
 * — the last word on which key encrypts the column.
 */
export type StagedFieldEncryption = {
  entity: Function;
  field: string;
  encrypted: MetaEncrypted;
};

/**
 * Fold this source's staged field encryptions into its OWN copy of the metadata,
 * creating a new object. Does NOT mutate the original — raw entity metadata is
 * shared across sources, so a staged override on one source must never leak to a
 * sibling source resolving the same entity.
 *
 * Applied AFTER the naming strategy and the source-level encryption default, so
 * precedence on a field is: staged > source `encryption` default > the
 * decorator's own selector. A field with no staged override is passed through
 * untouched.
 */
export const applyStagedEncryptions = (
  metadata: EntityMetadata,
  target: Function,
  staged: ReadonlyArray<StagedFieldEncryption>,
): EntityMetadata => {
  const forTarget = staged.filter((entry) => entry.entity === target);
  if (forTarget.length === 0) return metadata;

  return {
    ...metadata,
    fields: metadata.fields.map((field) => {
      const match = forTarget.find((entry) => entry.field === field.key);
      return match ? { ...field, encrypted: match.encrypted } : field;
    }),
  };
};
