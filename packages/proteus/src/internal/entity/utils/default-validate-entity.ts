import type { Constructor } from "@lindorm/types";
import { z } from "zod";
import type { IEntity } from "../../../interfaces/index.js";
import type { MetaField } from "../types/metadata.js";
import { getEntityMetadata } from "../metadata/get-entity-metadata.js";

const fieldWithMinMax = [
  "array",
  "smallint",
  "integer",
  "real",
  "float",
  "string",
  "text",
];

const schemaCache = new WeakMap<Constructor<any>, z.ZodObject<any>>();

const getValidator = (field: MetaField): z.ZodType | undefined => {
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
      return z.uuid();

    case "email":
      return z.email();

    case "url":
      return z.url();

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
      return z.looseObject({});

    case "binary":
      return z.custom<Buffer>((val) => Buffer.isBuffer(val));

    default:
      return;
  }
};

const buildSchema = (target: Constructor<any>): z.ZodObject<any> => {
  const metadata = getEntityMetadata(target);
  const validators: Record<string, z.ZodType> = {};

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
        validator = (validator as z.ZodString).refine((val) => parseFloat(val) >= min, {
          error: `Value must be >= ${min}`,
        });
      }
      if (field.max != null) {
        const max = field.max;
        validator = (validator as z.ZodString).refine((val) => parseFloat(val) <= max, {
          error: `Value must be <= ${max}`,
        });
      }
    }
    if (field.type && fieldWithMinMax.includes(field.type) && field.min != null) {
      validator = (validator as z.ZodArray<any> | z.ZodNumber | z.ZodString).min(
        field.min,
      );
    }
    if (field.type && fieldWithMinMax.includes(field.type) && field.max != null) {
      validator = (validator as z.ZodArray<any> | z.ZodNumber | z.ZodString).max(
        field.max,
      );
    }
    if (field.nullable) {
      validator = validator.nullish();
    }
    validators[field.key] = validator;
  }

  // Build nested validators for embedded objects
  for (const [parentKey, fields] of embeddedGroups) {
    const nestedShape: Record<string, z.ZodType> = {};
    for (const field of fields) {
      const nestedKey = field.key.split(".")[1];
      let validator = getValidator(field);
      if (!validator) continue;
      if (field.type === "decimal") {
        if (field.min != null) {
          const min = field.min;
          validator = (validator as z.ZodString).refine((val) => parseFloat(val) >= min, {
            error: `Value must be >= ${min}`,
          });
        }
        if (field.max != null) {
          const max = field.max;
          validator = (validator as z.ZodString).refine((val) => parseFloat(val) <= max, {
            error: `Value must be <= ${max}`,
          });
        }
      }
      if (field.type && fieldWithMinMax.includes(field.type) && field.min != null) {
        validator = (validator as z.ZodArray<any> | z.ZodNumber | z.ZodString).min(
          field.min,
        );
      }
      if (field.type && fieldWithMinMax.includes(field.type) && field.max != null) {
        validator = (validator as z.ZodArray<any> | z.ZodNumber | z.ZodString).max(
          field.max,
        );
      }
      if (field.nullable) {
        validator = validator.nullish();
      }
      nestedShape[nestedKey] = validator;
    }
    // The embedded object itself can be null
    validators[parentKey] = z.strictObject(nestedShape).nullish();
  }

  // Declare slots for relations, relationIds, relationCounts, and implicit
  // join-key FK columns so strict validation doesn't reject them. Contents
  // vary (arrays, proxies, scalars) and are validated elsewhere.
  for (const relation of metadata.relations) {
    validators[relation.key] = z.any().optional();
    if (relation.joinKeys) {
      for (const joinKey of Object.keys(relation.joinKeys)) {
        validators[joinKey] = z.any().optional();
      }
    }
  }
  for (const relationId of metadata.relationIds) {
    validators[relationId.key] = z.any().optional();
  }
  for (const relationCount of metadata.relationCounts) {
    validators[relationCount.key] = z.any().optional();
  }

  // Add validators for @EmbeddedList fields
  for (const el of metadata.embeddedLists) {
    if (el.elementFields && el.elementConstructor) {
      // Embeddable element type: array of objects with typed fields
      const elementShape: Record<string, z.ZodType> = {};
      for (const field of el.elementFields) {
        let validator = getValidator(field);
        if (!validator) continue;
        if (field.nullable) {
          validator = validator.nullish();
        }
        elementShape[field.key] = validator;
      }
      validators[el.key] = z.array(z.strictObject(elementShape));
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

  return z.strictObject(validators) as z.ZodObject<any>;
};

export const defaultValidateEntity = <E extends IEntity>(
  target: Constructor<E>,
  entity: E,
): void => {
  let cached = schemaCache.get(target);
  if (!cached) {
    cached = buildSchema(target);
    schemaCache.set(target, cached);
  }
  cached.parse(entity);
  const metadata = getEntityMetadata(target);
  for (const s of metadata.schemas) {
    s.parse(entity);
  }
};
