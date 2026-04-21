import type { NamedDecoratorOptions } from "../internal/entity/types/decorators.js";
import { stageField } from "../internal/entity/metadata/stage-metadata.js";

/**
 * Declare a timestamp field for soft-delete tracking.
 *
 * When the entity is soft-destroyed, this field is set to the current time.
 * Nullable — `null` means the entity is not deleted.
 * Entities with a non-null delete date are excluded from queries by default
 * (use `withDeleted` to include them).
 */
export const DeleteDateField =
  (options: NamedDecoratorOptions = {}) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageField(context.metadata, {
      key: String(context.name),
      decorator: "DeleteDate",
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
      nullable: true,
      order: null,
      precision: null,
      readonly: false,
      scale: null,
      schema: null,
      transform: null,
      type: "timestamp",
    });
  };
