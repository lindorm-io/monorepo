import { IrisMetadataError } from "../../../errors/IrisMetadataError.js";
import type { MetaField } from "../types/metadata.js";
import type { MetaFieldDecorator } from "../types/types.js";

const UNIQUE_DECORATORS: Array<MetaFieldDecorator> = [
  "IdentifierField",
  "TimestampField",
  "CorrelationField",
  "MandatoryField",
  "PersistentField",
];

export const validateFields = (targetName: string, fields: Array<MetaField>): void => {
  const seenKeys = new Set<string>();
  const seenDecorators = new Set<MetaFieldDecorator>();

  for (const field of fields) {
    if (seenKeys.has(field.key)) {
      throw new IrisMetadataError("Duplicate field metadata", {
        code: "duplicate_field_metadata",
        title: "Duplicate Field Metadata",
        details:
          "Two field decorators were registered for the same property key on the message class. Each property may have only one field decorator.",
        debug: { target: targetName, field: field.key },
      });
    }
    seenKeys.add(field.key);

    const decorator = field.decorator;

    if (UNIQUE_DECORATORS.includes(decorator)) {
      if (seenDecorators.has(decorator)) {
        throw new IrisMetadataError("Duplicate unique field type", {
          code: "duplicate_unique_field",
          title: "Duplicate Unique Field",
          details:
            "A field decorator that may appear only once per message was applied to more than one property. Use this decorator on a single field.",
          debug: { target: targetName, field: field.key, decorator },
        });
      }
      seenDecorators.add(decorator);
    }
  }
};
