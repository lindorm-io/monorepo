import type { Constructor } from "@lindorm/types";
import { z, ZodArray, ZodNumber, ZodObject, ZodRawShape, ZodString, ZodType } from "zod";
import { IEntity } from "../../../interfaces";
import type { MetaField } from "../types/metadata";
import { getEntityMetadata } from "../metadata/get-entity-metadata";

const fieldWithMinMax = [
  "array",
  "smallint",
  "integer",
  "real",
  "float",
  "string",
  "text",
];

const schemaCache = new WeakMap<Constructor<any>, ZodObject<any>>();

const getValidator = (field: MetaField): ZodType<any> | undefined => {
  switch (field.type) {
    case "boolean":
      return z.boolean();

    case "smallint":
    case "integer":
      return z.number().int();

    case "bigint":
      return z.bigint();

    case "real":
    case "float":
      return z.number();

    case "decimal":
      return z.string();

    case "string":
    case "text":
    case "xml":
    case "time":
    case "interval":
    case "inet":
    case "cidr":
    case "macaddr":
      return z.string();

    case "uuid":
      return z.string().uuid();

    case "email":
      return z.string().email();

    case "url":
      return z.string().url();

    case "enum":
      return z.nativeEnum(
        field.enum! as { [k: string]: string | number; [nu: number]: string },
      );

    case "date":
    case "timestamp":
      return z.date();

    case "array":
      return z.array(z.any());

    case "object":
    case "json":
      return z.object({}).passthrough();

    case "binary":
      return z.instanceof(Buffer);

    default:
      return;
  }
};

const buildSchema = (target: Constructor<any>): ZodObject<any> => {
  const metadata = getEntityMetadata(target);
  const validators: ZodRawShape = {};

  // Group embedded fields by parentKey for nested validation
  const embeddedGroups = new Map<string, Array<MetaField>>();

  for (const field of metadata.fields) {
    if (field.computed) continue;

    // Skip embedded fields from the flat schema — validated as nested objects below
    if (field.embedded) {
      let group = embeddedGroups.get(field.embedded.parentKey);
      if (!group) {
        group = [];
        embeddedGroups.set(field.embedded.parentKey, group);
      }
      group.push(field);
      continue;
    }

    let validator = getValidator(field);
    if (!validator) continue;
    if (field.type === "decimal") {
      if (field.min != null) {
        const min = field.min;
        validator = (validator as ZodString).refine((val) => parseFloat(val) >= min, {
          message: `Value must be >= ${min}`,
        });
      }
      if (field.max != null) {
        const max = field.max;
        validator = (validator as ZodString).refine((val) => parseFloat(val) <= max, {
          message: `Value must be <= ${max}`,
        });
      }
    }
    if (field.type && fieldWithMinMax.includes(field.type) && field.min != null) {
      validator = (validator as ZodArray<any> | ZodNumber | ZodString).min(field.min);
    }
    if (field.type && fieldWithMinMax.includes(field.type) && field.max != null) {
      validator = (validator as ZodArray<any> | ZodNumber | ZodString).max(field.max);
    }
    if (field.nullable) {
      validator = validator.nullish();
    }
    validators[field.key] = validator;
  }

  // Build nested validators for embedded objects
  for (const [parentKey, fields] of embeddedGroups) {
    const nestedShape: ZodRawShape = {};
    for (const field of fields) {
      const nestedKey = field.key.split(".")[1];
      let validator = getValidator(field);
      if (!validator) continue;
      if (field.type === "decimal") {
        if (field.min != null) {
          const min = field.min;
          validator = (validator as ZodString).refine((val) => parseFloat(val) >= min, {
            message: `Value must be >= ${min}`,
          });
        }
        if (field.max != null) {
          const max = field.max;
          validator = (validator as ZodString).refine((val) => parseFloat(val) <= max, {
            message: `Value must be <= ${max}`,
          });
        }
      }
      if (field.type && fieldWithMinMax.includes(field.type) && field.min != null) {
        validator = (validator as ZodArray<any> | ZodNumber | ZodString).min(field.min);
      }
      if (field.type && fieldWithMinMax.includes(field.type) && field.max != null) {
        validator = (validator as ZodArray<any> | ZodNumber | ZodString).max(field.max);
      }
      if (field.nullable) {
        validator = validator.nullish();
      }
      nestedShape[nestedKey] = validator;
    }
    // The embedded object itself can be null
    validators[parentKey] = z.object(nestedShape).passthrough().nullish();
  }

  // Add validators for @EmbeddedList fields
  for (const el of metadata.embeddedLists) {
    if (el.elementFields && el.elementConstructor) {
      // Embeddable element type: array of objects with typed fields
      const elementShape: ZodRawShape = {};
      for (const field of el.elementFields) {
        let validator = getValidator(field);
        if (!validator) continue;
        if (field.nullable) {
          validator = validator.nullish();
        }
        elementShape[field.key] = validator;
      }
      validators[el.key] = z.array(z.object(elementShape).passthrough());
    } else if (el.elementType) {
      // Primitive element type — create a minimal field-like object for getValidator
      const elementValidator = getValidator({
        type: el.elementType,
        enum: null,
      } as MetaField);
      if (elementValidator) {
        validators[el.key] = z.array(elementValidator);
      } else {
        validators[el.key] = z.array(z.any());
      }
    } else {
      validators[el.key] = z.array(z.any());
    }
  }

  return z.object(validators).passthrough();
};

export const defaultValidateEntity = <E extends IEntity>(
  target: Constructor<E>,
  entity: E,
): void => {
  let schema = schemaCache.get(target);
  if (!schema) {
    schema = buildSchema(target);
    schemaCache.set(target, schema);
  }
  schema.parse(entity);
  const metadata = getEntityMetadata(target);
  for (const schema of metadata.schemas) {
    schema.parse(entity);
  }
};
