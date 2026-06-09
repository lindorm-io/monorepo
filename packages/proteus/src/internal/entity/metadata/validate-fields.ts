import { EntityMetadataError } from "../errors/EntityMetadataError.js";
import type { MetaField, MetaFieldDecorator, MetaFieldType } from "../types/metadata.js";

const UNIQUE_FIELDS: Array<MetaFieldDecorator> = [
  "CreateDate",
  "DeleteDate",
  "ExpiryDate",
  "UpdateDate",
  "Version",
  "VersionEndDate",
  "VersionStartDate",
];

const PRECISION_TYPES: Array<MetaFieldType> = ["decimal", "float", "real"];

const validateModifierFieldTypes = (targetName: string, field: MetaField): void => {
  const type = field.type;

  if (field.precision != null && (!type || !PRECISION_TYPES.includes(type))) {
    throw new EntityMetadataError(
      `@Precision on "${field.key}" requires a floating-point numeric type (decimal, float, real)`,
      {
        code: "invalid_precision_type",
        title: "Invalid Precision Type",
        details: `@Precision on "${field.key}" requires a floating-point numeric type (decimal, float, real), but the field is typed "${type ?? "unset"}" — remove @Precision or change the @Field type.`,
        debug: { target: targetName, field: field.key, actualType: type },
      },
    );
  }

  if (field.enum && type !== "enum") {
    throw new EntityMetadataError(`@Enum on "${field.key}" requires type "enum"`, {
      code: "invalid_enum_type",
      title: "Invalid Enum Type",
      details: `@Enum on "${field.key}" requires the @Field type to be "enum", but it is "${type ?? "unset"}" — set the field type to "enum" or remove @Enum.`,
      debug: { target: targetName, field: field.key, actualType: type },
    });
  }

  if (type === "enum" && !field.enum) {
    throw new EntityMetadataError(
      `Enum type on "${field.key}" requires an @Enum decorator with values`,
      {
        code: "missing_enum_decorator",
        title: "Missing Enum Decorator",
        details: `Field "${field.key}" is typed "enum" but has no @Enum decorator — add @Enum with the allowed values, or change the field type.`,
        debug: { target: targetName, field: field.key },
      },
    );
  }
};

export const validateFields = (targetName: string, fields: Array<MetaField>): void => {
  const seenKeys = new Set<string>();
  const seenNames = new Set<string>();
  const seenDecorators = new Set<MetaFieldDecorator>();

  for (const field of fields) {
    if (seenKeys.has(field.key)) {
      throw new EntityMetadataError("Duplicate field metadata", {
        code: "duplicate_field",
        title: "Duplicate Field",
        details: `Property "${field.key}" on "${targetName}" is decorated as a field more than once — declare each property with a single @Field decorator.`,
        debug: { target: targetName, field: field.key },
      });
    }
    seenKeys.add(field.key);

    if (seenNames.has(field.name)) {
      throw new EntityMetadataError("Duplicate field column name", {
        code: "duplicate_column",
        title: "Duplicate Column",
        details: `Two fields on "${targetName}" map to the same column "${field.name}" (latest is "${field.key}") — give each field a distinct column name.`,
        debug: { target: targetName, field: field.key, name: field.name },
      });
    }
    seenNames.add(field.name);

    const decorator = field.decorator;

    if (UNIQUE_FIELDS.includes(decorator)) {
      if (seenDecorators.has(decorator)) {
        throw new EntityMetadataError("Duplicate unique field type", {
          code: "duplicate_unique_decorator",
          title: "Duplicate Unique Decorator",
          details: `@${decorator} can appear only once per entity, but "${targetName}" declares it more than once (on "${field.key}") — keep a single @${decorator} field.`,
          debug: { target: targetName, field: field.key, decorator },
        });
      }
      seenDecorators.add(decorator);
    }

    validateModifierFieldTypes(targetName, field);
  }
};
