import { camelCase, snakeCase } from "@lindorm/case";
import type { Dict } from "@lindorm/types";
import type { EntityMetadata, MetaField } from "../../entity/types/metadata";
import type { NamingStrategy } from "../../../types/source-options";

const transformName = (name: string, strategy: NamingStrategy): string => {
  switch (strategy) {
    case "snake":
      return snakeCase(name);
    case "camel":
      return camelCase(name);
    case "none":
      return name;
  }
};

const resolveFieldName = (field: MetaField, strategy: NamingStrategy): string => {
  // If user explicitly set a column name (name !== key), preserve it
  if (field.name !== field.key) return field.name;
  return transformName(field.key, strategy);
};

const resolveJoinKeys = (
  joinKeys: Dict<string> | null,
  strategy: NamingStrategy,
): Dict<string> | null => {
  if (!joinKeys) return null;
  const resolved: Dict<string> = {};
  for (const [localKey, foreignKey] of Object.entries(joinKeys)) {
    resolved[transformName(localKey, strategy)] = foreignKey;
  }
  return resolved;
};

/**
 * Apply a naming strategy to metadata, creating a new metadata object with
 * resolved column names. Does NOT mutate the original metadata.
 *
 * Resolution order: explicit @Field({ name }) > naming strategy > field.key
 */
export const applyNamingStrategy = (
  metadata: EntityMetadata,
  strategy: NamingStrategy,
): EntityMetadata => {
  if (strategy === "none") return metadata;

  return {
    ...metadata,
    fields: metadata.fields.map((field) => ({
      ...field,
      name: resolveFieldName(field, strategy),
    })),
    relations: metadata.relations.map((relation) => ({
      ...relation,
      findKeys: resolveJoinKeys(relation.findKeys, strategy),
      joinKeys: resolveJoinKeys(relation.joinKeys, strategy),
    })),
    embeddedLists: (metadata.embeddedLists ?? []).map((el) => ({
      ...el,
      parentFkColumn: transformName(el.parentFkColumn, strategy),
      elementFields: el.elementFields
        ? el.elementFields.map((field) => ({
            ...field,
            name: resolveFieldName(field, strategy),
          }))
        : null,
    })),
  };
};
