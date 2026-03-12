import type { EntityMetadata } from "#internal/entity/types/metadata";

/**
 * Ensure the discriminator column is present with the correct metadata value
 * for single-table inheritance children. If the column was already included by
 * dehydrateEntity (from the entity instance), its value is overwritten to match
 * the metadata's discriminatorValue. This prevents accidental type mismatches
 * when the entity instance has an incorrect discriminator value.
 *
 * No-op for root entities and non-inheritance entities.
 */
export const applyDiscriminatorColumn = (
  columns: Array<{ column: string; value: unknown }>,
  metadata: EntityMetadata,
): void => {
  if (!metadata.inheritance) return;
  if (metadata.inheritance.discriminatorValue == null) return;

  const field = metadata.fields.find(
    (f) => f.key === metadata.inheritance!.discriminatorField,
  );
  if (!field) return;

  const existing = columns.find((c) => c.column === field.name);
  if (existing) {
    existing.value = metadata.inheritance.discriminatorValue;
  } else {
    columns.push({ column: field.name, value: metadata.inheritance.discriminatorValue });
  }
};
