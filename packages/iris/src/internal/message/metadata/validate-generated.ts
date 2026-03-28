import { IrisMetadataError } from "../../../errors/IrisMetadataError";
import type { MetaField } from "../types/metadata";
import type { MetaGenerated } from "../types/metadata";
import type { MetaFieldType, MetaGeneratedStrategy } from "../types/types";

const STRATEGY_TYPES: Record<MetaGeneratedStrategy, MetaFieldType> = {
  uuid: "uuid",
  date: "date",
  string: "string",
  integer: "integer",
  float: "float",
};

export const validateGenerated = (
  targetName: string,
  generated: Array<MetaGenerated>,
  fields: Array<MetaField>,
): void => {
  for (const gen of generated) {
    const field = fields.find((f) => f.key === gen.key);

    if (!field) {
      throw new IrisMetadataError("Generated field not found", {
        debug: { target: targetName, field: gen.key },
      });
    }

    const expectedType = STRATEGY_TYPES[gen.strategy];

    if (field.type !== expectedType) {
      throw new IrisMetadataError("Invalid @Generated strategy for field type", {
        debug: {
          target: targetName,
          field: field.key,
          strategy: gen.strategy,
          type: field.type,
        },
      });
    }
  }
};
