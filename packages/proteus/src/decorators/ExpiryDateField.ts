import type { NamedDecoratorOptions } from "#internal/entity/types/decorators";
import { stageField } from "#internal/entity/metadata/stage-metadata";

/**
 * Declare a timestamp field for TTL-based expiry.
 *
 * Nullable — `null` means the entity never expires.
 * Use `repository.deleteExpired()` to purge entities whose expiry date has passed.
 * Use `repository.ttl()` to check remaining time.
 */
export const ExpiryDateField =
  (options: NamedDecoratorOptions = {}) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageField(context.metadata, {
      key: String(context.name),
      decorator: "ExpiryDate",
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
