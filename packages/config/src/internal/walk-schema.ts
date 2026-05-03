import { z } from "zod";

export type SchemaLeaf = {
  path: ReadonlyArray<string>;
  schema: z.ZodType;
};

const getDef = (schema: z.ZodType): { type?: string; [k: string]: any } =>
  (schema as any)._zod?.def ?? (schema as any)._def ?? {};

/**
 * Walks a Zod schema and returns every leaf the schema can be filled at.
 *
 * Recurses into `object`, `optional`, `nullable`, and `default` wrappers.
 * Treats arrays, unions, enums, records, and primitives as leaves — env
 * vars cannot meaningfully shape an array of objects, so we let the
 * leaf consume one env value (parsed via `safelyParse`) and let Zod
 * validate it.
 *
 * Returns one entry per leaf so callers can compute env-var candidates
 * per-leaf without a second walk.
 */
export const walkSchemaLeaves = (
  schema: z.ZodType,
  path: ReadonlyArray<string> = [],
): Array<SchemaLeaf> => {
  const def = getDef(schema);

  switch (def.type) {
    case "object": {
      const shape = def.shape as Record<string, z.ZodType> | undefined;
      if (!shape) return [{ path, schema }];

      const out: Array<SchemaLeaf> = [];
      for (const key of Object.keys(shape)) {
        out.push(...walkSchemaLeaves(shape[key], [...path, key]));
      }
      return out;
    }

    case "optional":
    case "nullable":
    case "default":
    case "readonly":
    case "nonoptional":
      return walkSchemaLeaves(def.innerType as z.ZodType, path);

    default:
      return [{ path, schema }];
  }
};
