import { z } from "zod";
import { IrisSerializationError } from "../../../errors/IrisSerializationError";
import type { MetaField } from "../types/metadata";
import type { MessageMetadata } from "../types/metadata";

const fieldWithMinMax = ["array", "bigint", "integer", "float", "string"];

const getValidator = (field: MetaField): z.ZodType | undefined => {
  switch (field.type) {
    case "boolean":
      return z.boolean();

    case "integer":
      return z.number().int();

    case "bigint":
      return z.bigint();

    case "float":
      return z.number();

    case "string":
      return z.string();

    case "uuid":
      return z.uuid();

    case "email":
      return z.email();

    case "url":
      return z.url();

    case "enum":
      if (!field.enum) {
        throw new IrisSerializationError(
          `Field "${field.key}" has type "enum" but no enum values provided`,
        );
      }
      return z.nativeEnum(
        field.enum as { [k: string]: string | number; [nu: number]: string },
      );

    case "date":
      return z.date();

    case "array":
      return z.array(z.any());

    case "object":
      return z.looseObject({});

    default:
      return;
  }
};

export const buildSchema = (metadata: MessageMetadata): z.ZodType => {
  const validators: Record<string, z.ZodType> = {};

  for (const field of metadata.fields) {
    // If a custom @Schema is provided, use it directly as the validator
    if (field.schema) {
      let validator: z.ZodType = field.schema;
      if (field.nullable && field.optional) {
        validator = validator.nullish();
      } else if (field.nullable) {
        validator = validator.nullable();
      } else if (field.optional) {
        validator = validator.optional();
      }
      validators[field.key] = validator;
      continue;
    }

    let validator = getValidator(field);
    if (!validator) continue;

    if (fieldWithMinMax.includes(field.type) && field.min != null) {
      if (field.type === "bigint") {
        validator = (validator as z.ZodBigInt).min(BigInt(field.min));
      } else {
        validator = (validator as z.ZodArray<any> | z.ZodNumber | z.ZodString).min(
          field.min,
        );
      }
    }
    if (fieldWithMinMax.includes(field.type) && field.max != null) {
      if (field.type === "bigint") {
        validator = (validator as z.ZodBigInt).max(BigInt(field.max));
      } else {
        validator = (validator as z.ZodArray<any> | z.ZodNumber | z.ZodString).max(
          field.max,
        );
      }
    }
    if (field.nullable && field.optional) {
      validator = validator.nullish();
    } else if (field.nullable) {
      validator = validator.nullable();
    } else if (field.optional) {
      validator = validator.optional();
    }

    validators[field.key] = validator;
  }

  return z.strictObject(validators);
};
