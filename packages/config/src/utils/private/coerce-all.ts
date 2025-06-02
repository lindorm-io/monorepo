import { Dict } from "@lindorm/types";
import { z, ZodFirstPartyTypeKind, ZodTypeAny } from "zod";

export const coerceAll = <T extends ZodTypeAny>(schema: T): T => {
  const def = schema._def;

  switch (def.typeName) {
    case ZodFirstPartyTypeKind.ZodString:
      return z.coerce.string(def) as any;

    case ZodFirstPartyTypeKind.ZodNumber:
      return z.coerce.number(def) as any;

    case ZodFirstPartyTypeKind.ZodBoolean:
      return z.coerce.boolean(def) as any;

    case ZodFirstPartyTypeKind.ZodDate:
      return z.coerce.date(def) as any;

    case ZodFirstPartyTypeKind.ZodBigInt:
      return z.coerce.bigint(def) as any;

    case ZodFirstPartyTypeKind.ZodArray:
      return z.array(coerceAll(def.type), def) as any;

    case ZodFirstPartyTypeKind.ZodObject: {
      const shape = (def.shape as () => Dict<ZodTypeAny>)();
      const newShape: Dict<ZodTypeAny> = {};
      for (const key in shape) {
        newShape[key] = coerceAll(shape[key]);
      }
      return z.object(newShape, def) as any;
    }

    default:
      return schema;
  }
};
