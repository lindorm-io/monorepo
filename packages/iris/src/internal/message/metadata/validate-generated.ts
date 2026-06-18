import { IrisMetadataError } from "../../../errors/IrisMetadataError.js";
import type { MetaField } from "../types/metadata.js";
import type { MetaGenerated } from "../types/metadata.js";
import type { MetaFieldType, MetaGeneratedStrategy } from "../types/types.js";

const STRATEGY_TYPES: Record<MetaGeneratedStrategy, MetaFieldType> = {
  uuid: "uuid",
  date: "date",
  string: "string",
  integer: "integer",
  float: "float",
  lindorm_id: "string",
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
        code: "generated_field_not_found",
        title: "Generated Field Not Found",
        details:
          "A @Generated decorator references a property that has no corresponding @Field. Add a @Field decorator to the generated property.",
        debug: { target: targetName, field: gen.key },
      });
    }

    if (gen.generator) continue;

    const expectedType = STRATEGY_TYPES[gen.strategy as MetaGeneratedStrategy];

    if (field.type !== expectedType) {
      throw new IrisMetadataError("Invalid @Generated strategy for field type", {
        code: "invalid_generated_strategy",
        title: "Invalid Generated Strategy",
        details:
          "The @Generated strategy does not match the field's declared type, for example a uuid strategy on a non-uuid field. Align the strategy with the field type.",
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
