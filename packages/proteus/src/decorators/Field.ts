import type { FieldDecoratorOptions } from "../internal/entity/types/decorators.js";
import type { MetaFieldType } from "../internal/entity/types/metadata.js";
import { stageField } from "../internal/entity/metadata/stage-metadata.js";

/**
 * Declare a persistent field on an entity.
 *
 * - `@Field("string")` — explicit column type
 * - `@Field("string", { name: "col" })` — explicit type with column name override
 */
export const Field =
  (type: MetaFieldType, options?: FieldDecoratorOptions) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageField(context.metadata, {
      key: String(context.name),
      decorator: "Field",
      arrayType: options?.arrayType ?? null,
      collation: null,
      comment: null,
      computed: null,
      embedded: null,
      encrypted: null,
      enum: null,
      default: null,
      hideOn: [],
      max: null,
      min: null,
      name: options?.name ?? String(context.name),
      nullable: false,
      order: null,
      precision: null,
      readonly: false,
      scale: null,
      schema: null,
      transform: null,
      type,
    });
  };
