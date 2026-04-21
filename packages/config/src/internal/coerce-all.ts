import type { Dict } from "@lindorm/types";
import { z } from "zod";

export const coerceAll = <T extends z.ZodType>(schema: T): T => {
  const def = (schema as any)._zod?.def ?? (schema as any)._def;

  switch (def.type) {
    case "string":
      return z.coerce.string() as any;

    case "number":
      return z.coerce.number() as any;

    case "boolean":
      return z.coerce.boolean() as any;

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

    default:
      return schema;
  }
};
