import type { NamedDecoratorOptions } from "../internal/entity/types/decorators.js";
import {
  stageField,
  stageGenerated,
} from "../internal/entity/metadata/stage-metadata.js";

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
      named: options.name != null,
      nullable: false,
      order: null,
      precision: null,
      readonly: ["update", "upsert"],
      scale: null,
      schema: null,
      sensitive: null,
      transform: null,
      typedJson: null,
      type: "timestamp",
    });

    stageGenerated(context.metadata, {
      key,
      strategy: "date",
      length: null,
      max: null,
      min: null,
      namespace: null,
    });
  };
