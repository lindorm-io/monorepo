import type { NamedDecoratorOptions } from "../internal/entity/types/decorators";
import { stageField, stageGenerated } from "../internal/entity/metadata/stage-metadata";

/**
 * Declare the start timestamp for temporal/versioned tables.
 *
 * Set automatically on insert and when a new version is created.
 * Read-only, non-nullable, and auto-generated with the `"date"` strategy.
 */
export const VersionStartDateField =
  (options: NamedDecoratorOptions = {}) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    const key = String(context.name);

    stageField(context.metadata, {
      key,
      decorator: "VersionStartDate",
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
      name: options.name ?? key,
      nullable: false,
      order: null,
      precision: null,
      readonly: true,
      scale: null,
      schema: null,
      transform: null,
      type: "timestamp",
    });

    stageGenerated(context.metadata, {
      key,
      strategy: "date",
      length: null,
      max: null,
      min: null,
    });
  };
