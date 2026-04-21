import type { NamedDecoratorOptions } from "../internal/entity/types/decorators.js";
import { stageField } from "../internal/entity/metadata/stage-metadata.js";

/**
 * Declare an integer field for optimistic locking.
 *
 * Automatically incremented on every update. The ORM checks that the
 * version in the database matches the entity's version before applying
 * an update, throwing on conflict.
 */
export const VersionField =
  (options: NamedDecoratorOptions = {}) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageField(context.metadata, {
      key: String(context.name),
      decorator: "Version",
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
      type: "integer",
    });
  };
