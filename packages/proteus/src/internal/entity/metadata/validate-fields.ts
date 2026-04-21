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
      { debug: { target: targetName, field: field.key, actualType: type } },
    );
  }

  if (field.enum && type !== "enum") {
    throw new EntityMetadataError(`@Enum on "${field.key}" requires type "enum"`, {
      debug: { target: targetName, field: field.key, actualType: type },
    });
  }

  if (type === "enum" && !field.enum) {
    throw new EntityMetadataError(
      `Enum type on "${field.key}" requires an @Enum decorator with values`,
      { debug: { target: targetName, field: field.key } },
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
        debug: { target: targetName, field: field.key },
      });
    }
    seenKeys.add(field.key);

    if (seenNames.has(field.name)) {
      throw new EntityMetadataError("Duplicate field column name", {
        debug: { target: targetName, field: field.key, name: field.name },
      });
    }
    seenNames.add(field.name);

    const decorator = field.decorator;

    if (UNIQUE_FIELDS.includes(decorator)) {
      if (seenDecorators.has(decorator)) {
        throw new EntityMetadataError("Duplicate unique field type", {
          debug: { target: targetName, field: field.key, decorator },
        });
      }
      seenDecorators.add(decorator);
    }

    validateModifierFieldTypes(targetName, field);
  }
};
