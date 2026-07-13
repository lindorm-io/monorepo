import { IrisMetadataError } from "../../../errors/IrisMetadataError.js";
import type { MetaField } from "../types/metadata.js";
import type { MetaFieldDecorator, MetaFieldType } from "../types/types.js";

const UNIQUE_DECORATORS: Array<MetaFieldDecorator> = [
  "IdentifierField",
  "TimestampField",
  "CorrelationField",
  "MandatoryField",
  "PersistentField",
];

const SENSITIVE_DIGEST_TYPES: Array<MetaFieldType> = ["string"];

const validateSensitive = (targetName: string, field: MetaField): void => {
  if (!field.sensitive?.digest) return;

  if (field.schema) {
    throw new IrisMetadataError(
      `@Sensitive digest and field-level @Schema cannot be combined on "${field.key}"`,
      {
        code: "sensitive_digest_schema_conflict",
        title: "Sensitive Digest Schema Conflict",
        details: `Field "${field.key}" on "${targetName}" declares both a @Sensitive digest ("${field.sensitive.digest}") and a field-level @Schema — a digest field holds an opaque hash string, so a custom schema is nonsensical; remove one of the two.`,
        debug: { target: targetName, field: field.key, digest: field.sensitive.digest },
      },
    );
  }

  if (!SENSITIVE_DIGEST_TYPES.includes(field.type)) {
    throw new IrisMetadataError(
      `@Sensitive digest on "${field.key}" requires a "string" field`,
      {
        code: "invalid_sensitive_digest_type",
        title: "Invalid Sensitive Digest Type",
        details: `@Sensitive({ digest: "${field.sensitive.digest}" }) on "${field.key}" requires the @Field type to be "string", but it is "${field.type}" — change the field type or drop the digest (a bare @Sensitive() is valid on any type).`,
        debug: { target: targetName, field: field.key, actualType: field.type },
      },
    );
  }
};

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

    validateSensitive(targetName, field);

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
