import type { EntityMetadata } from "../../entity/types/metadata";

export const getUpsertSetSkipColumns = (metadata: EntityMetadata): Set<string> => {
  const skip = new Set<string>();

  // Skip PK columns — they are the conflict target, not updatable
  for (const pk of metadata.primaryKeys) {
    const field = metadata.fields.find((f) => f.key === pk);
    if (field) skip.add(field.name);
  }

  // Skip CreateDate — immutable; skip computed — DB-generated
  for (const field of metadata.fields) {
    if (field.decorator === "CreateDate") {
      skip.add(field.name);
    }
    if (field.computed) {
      skip.add(field.name);
    }
  }

  // Skip generated increment/identity fields
  for (const gen of metadata.generated) {
    if (gen.strategy === "increment" || gen.strategy === "identity") {
      const field = metadata.fields.find((f) => f.key === gen.key);
      if (field) skip.add(field.name);
    }
  }

  // Skip discriminator column — immutable once set
  if (metadata.inheritance?.discriminatorField) {
    const discField = metadata.fields.find(
      (f) => f.key === metadata.inheritance!.discriminatorField,
    );
    if (discField) skip.add(discField.name);
  }

  return skip;
};
