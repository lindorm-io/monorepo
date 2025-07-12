import { Constructor } from "@lindorm/types";
import { z, ZodArray, ZodNumber, ZodRawShape, ZodString, ZodType } from "zod";
import { IEntity } from "../interfaces";
import { MetaColumn } from "../types";
import { globalEntityMetadata } from "./global";

const getValidator = (column: Omit<MetaColumn, "target">): ZodType<any> | undefined => {
  switch (column.type) {
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
      return z.nativeEnum(column.enum);

    case "float":
      return z.number();

    case "integer":
      return z.number();

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

export const defaultValidateEntity = <E extends IEntity>(
  target: Constructor<E>,
  entity: E,
): void => {
  const metadata = globalEntityMetadata.get(target);
  const validators: ZodRawShape = {};

  for (const column of metadata.columns) {
    let validator = getValidator(column);

    if (!validator) continue;

    if (
      column.type &&
      ["array", "number", "string"].includes(column.type) &&
      column.min
    ) {
      validator = (validator as ZodArray<any> | ZodNumber | ZodString).min(column.min);
    }

    if (
      column.type &&
      ["array", "number", "string"].includes(column.type) &&
      column.max
    ) {
      validator = (validator as ZodArray<any> | ZodNumber | ZodString).max(column.max);
    }

    if (column.nullable) {
      validator = validator.nullable();
    }

    if (column.optional) {
      validator = validator.optional();
    }

    validators[column.key] = validator;
  }

  z.object(validators).passthrough().parse(entity);

  for (const schema of metadata.schemas) {
    schema.parse(entity);
  }

  const hooks = metadata.hooks.filter((h) => h.decorator === "OnValidate");

  for (const hook of hooks) {
    hook.callback(entity);
  }
};
