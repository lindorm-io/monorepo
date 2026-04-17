import type { NamedDecoratorOptions } from "../internal/entity/types/decorators";
import { stageField } from "../internal/entity/metadata/stage-metadata";

/**
 * Declare a timestamp field that is automatically set to the current time on every update.
 *
 * The field is read-only and non-nullable. Updated by the ORM pipeline before each UPDATE.
 */
export const UpdateDateField =
  (options: NamedDecoratorOptions = {}) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageField(context.metadata, {
      key: String(context.name),
      decorator: "UpdateDate",
      arrayType: null,
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
      name: options.name ?? String(context.name),
      nullable: false,
      order: null,
      precision: null,
      readonly: true,
      scale: null,
      schema: null,
      transform: null,
      type: "timestamp",
    });
  };
