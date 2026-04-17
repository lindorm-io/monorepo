import type { NamedDecoratorOptions } from "../internal/entity/types/decorators";
import { stageField } from "../internal/entity/metadata/stage-metadata";

/**
 * Declare the end timestamp for temporal/versioned tables.
 *
 * Nullable — `null` means the version is the current active version.
 * Set automatically when a new version supersedes an existing one.
 */
export const VersionEndDateField =
  (options: NamedDecoratorOptions = {}) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageField(context.metadata, {
      key: String(context.name),
      decorator: "VersionEndDate",
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
