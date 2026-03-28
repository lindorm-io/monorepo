import { IrisMetadataError } from "../../../errors/IrisMetadataError";
import type { MetaField } from "../types/metadata";
import type { MetaFieldDecorator } from "../types/types";

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
        debug: { target: targetName, field: field.key },
      });
    }
    seenKeys.add(field.key);

    const decorator = field.decorator;

    if (UNIQUE_DECORATORS.includes(decorator)) {
      if (seenDecorators.has(decorator)) {
        throw new IrisMetadataError("Duplicate unique field type", {
          debug: { target: targetName, field: field.key, decorator },
        });
      }
      seenDecorators.add(decorator);
    }
  }
};
