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

// Role-marker decorators declare a field's role, not its column/value type. When one
// of these carries a @Generated, the strategy determines the field type.
const ROLE_MARKERS = new Set(["IdentifierField", "CorrelationField", "TimestampField"]);

export const validateGenerated = (
  targetName: string,
  generated: Array<MetaGenerated>,
  fields: Array<MetaField>,
): void => {
  const seen = new Set<string>();

  for (const gen of generated) {
    if (seen.has(gen.key)) {
      throw new IrisMetadataError("Duplicate @Generated for field", {
        code: "duplicate_generated_field",
        title: "Duplicate Generated Field",
        details:
          "Two @Generated decorators target the same property. A field can only have a single generator. Remove the duplicate @Generated decorator.",
        debug: { target: targetName, field: gen.key },
      });
    }

    seen.add(gen.key);
  }

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

    // Role markers (@IdentifierField/@CorrelationField/@TimestampField) declare the
    // field's ROLE, not its type — so the @Generated strategy determines the type.
    // The marker's own type is only a fallback for the bare (no-@Generated) case.
    if (ROLE_MARKERS.has(field.decorator)) {
      field.type = expectedType;
      continue;
    }

    // An explicit @Field type must agree with the strategy.
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
