import { Constructor } from "@lindorm/types";
import { z, ZodArray, ZodNumber, ZodRawShape, ZodString, ZodType } from "zod";
import { IMessage } from "../interfaces";
import { MetaField } from "../types";
import { globalMessageMetadata } from "./global";

const getValidator = (field: Omit<MetaField, "target">): ZodType<any> | undefined => {
  switch (field.type) {
    case "array":
      return z.array(z.any());

    case "bigint":
      return z.bigint();

    case "boolean":
      return z.boolean();

    case "date":
      return z.date();

    case "email":
      return z.string().email();

    case "enum":
      return z.nativeEnum(field.enum);

    case "float":
      return z.number();

    case "integer":
      return z.number().int();

    case "object":
      return z.object({}).passthrough();

    case "string":
      return z.string();

    case "url":
      return z.string().url();

    case "uuid":
      return z.string().uuid();

    default:
      return;
  }
};

export const defaultValidateMessage = <M extends IMessage>(
  target: Constructor<M>,
  message: M,
): void => {
  const metadata = globalMessageMetadata.get(target);
  const validators: ZodRawShape = {};

  for (const field of metadata.fields) {
    let validator = getValidator(field);

    if (!validator) continue;

    if (field.type && ["array", "number", "string"].includes(field.type) && field.min) {
      validator = (validator as ZodArray<any> | ZodNumber | ZodString).min(field.min);
    }

    if (field.type && ["array", "number", "string"].includes(field.type) && field.max) {
      validator = (validator as ZodArray<any> | ZodNumber | ZodString).max(field.max);
    }

    if (field.nullable) {
      validator = validator.nullable();
    }

    if (field.optional) {
      validator = validator.optional();
    }

    validators[field.key] = validator;
  }

  z.object(validators).passthrough().parse(message);

  if (metadata.schema) {
    metadata.schema.parse(message);
  }

  const hooks = metadata.hooks.filter((h) => h.decorator === "OnValidate");

  for (const hook of hooks) {
    hook.callback(message);
  }
};
