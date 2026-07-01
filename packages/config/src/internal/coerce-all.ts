import type { Dict } from "@lindorm/types";
import { z } from "zod";

const TRUTHY = new Set(["true", "1", "yes", "on"]);
const FALSY = new Set(["false", "0", "no", "off", ""]);

// z.coerce.boolean() is `Boolean(value)`, so any non-empty string ("false"!)
// becomes true. Env values arrive as raw strings, so coerce them explicitly:
// recognised truthy/falsy words map; a real boolean passes through; anything
// else is left for z.boolean() to reject.
const coerceBoolean = (): z.ZodType =>
  z.preprocess((value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const token = value.trim().toLowerCase();
      if (TRUTHY.has(token)) return true;
      if (FALSY.has(token)) return false;
    }
    return value;
  }, z.boolean());

export const coerceAll = <T extends z.ZodType>(schema: T): T => {
  const def = (schema as any)._zod?.def ?? (schema as any)._def;

  switch (def.type) {
    case "string":
      return z.coerce.string() as any;

    case "number":
      return z.coerce.number() as any;

    case "boolean":
      return coerceBoolean() as any;

    case "date":
      return z.coerce.date() as any;

    case "bigint":
      return z.coerce.bigint() as any;

    case "array":
      return z.array(coerceAll(def.element)) as any;

    case "object": {
      const shape = def.shape as Dict<z.ZodType>;
      const newShape: Dict<z.ZodType> = {};
      for (const key in shape) {
        newShape[key] = coerceAll(shape[key]);
      }
      return z.object(newShape) as any;
    }

    case "optional":
      return coerceAll(def.innerType).optional();

    case "nullable":
      return coerceAll(def.innerType).nullable();

    case "default":
      return coerceAll(def.innerType).default(def.defaultValue);

    case "prefault":
      return coerceAll(def.innerType).prefault(def.defaultValue);

    case "readonly":
      return coerceAll(def.innerType).readonly();

    case "nonoptional":
      return coerceAll(def.innerType).nonoptional();

    default:
      return schema;
  }
};
