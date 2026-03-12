import type { EntityMetadata } from "#internal/entity/types/metadata";

/**
 * Get the column name of the discriminator field, if this entity is a
 * single-table inheritance child. Returns null otherwise.
 */
export const getDiscriminatorColumnName = (metadata: EntityMetadata): string | null => {
  if (!metadata.inheritance) return null;
  if (metadata.inheritance.discriminatorValue == null) return null;

  const field = metadata.fields.find(
    (f) => f.key === metadata.inheritance!.discriminatorField,
  );
  return field?.name ?? null;
};
