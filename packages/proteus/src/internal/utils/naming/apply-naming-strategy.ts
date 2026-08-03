import { camelCase, snakeCase } from "@lindorm/case";
import type { Dict } from "@lindorm/types";
import type {
  EntityMetadata,
  MetaField,
  MetaTypedJson,
} from "../../entity/types/metadata.js";
import type { NamingStrategy } from "../../../types/source-options.js";

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
  // If the user explicitly set a column name, preserve it verbatim — even when it
  // happens to equal the property key (`@Field("string", { name: "createdAt" })`).
  if (field.named) return field.name;
  // A flattened @Embedded field has a DOTTED key (`homeAddress.street`) but its
  // `name` is the resolved composite (`homeAddress_street`). Transform the
  // composite, not the key, so it follows the strategy (`home_address_street`).
  if (field.embedded) return transformName(field.name, strategy);
  return transformName(field.key, strategy);
};

// Resolve the sidecar column for a @TypedJson field after the data column is resolved.
// An explicit @TypedJson({ name }) is preserved verbatim; otherwise default to
// `<resolvedDataColumn>__typemeta`.
const resolveTypedJson = (
  typedJson: MetaTypedJson | null,
  resolvedDataColumn: string,
): MetaTypedJson | null => {
  if (!typedJson) return null;
  return { ...typedJson, column: typedJson.name ?? `${resolvedDataColumn}__typemeta` };
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
    entity: {
      ...metadata.entity,
      // An explicit `@Entity({ name })` is preserved verbatim; a default entity
      // name IS the class name, so transform it to follow the strategy.
      name: metadata.entity.named
        ? metadata.entity.name
        : transformName(metadata.entity.name, strategy),
    },
    fields: metadata.fields.map((field) => {
      const name = resolveFieldName(field, strategy);
      return { ...field, name, typedJson: resolveTypedJson(field.typedJson, name) };
    }),
    relations: metadata.relations.map((relation) => ({
      ...relation,
      findKeys: resolveJoinKeys(relation.findKeys, strategy),
      joinKeys: resolveJoinKeys(relation.joinKeys, strategy),
    })),
    embeddedLists: (metadata.embeddedLists ?? []).map((el) => ({
      ...el,
      parentFkColumn: transformName(el.parentFkColumn, strategy),
      // The parent PK is one of `fields`; renamed here too so a collection write
      // never dehydrates through a stale copy of it.
      parentPkField: el.parentPkField
        ? { ...el.parentPkField, name: resolveFieldName(el.parentPkField, strategy) }
        : null,
      elementFields: el.elementFields
        ? el.elementFields.map((field) => {
            const name = resolveFieldName(field, strategy);
            return { ...field, name, typedJson: resolveTypedJson(field.typedJson, name) };
          })
        : null,
    })),
  };
};
