import type { NamedDecoratorOptions } from "../internal/entity/types/decorators.js";
import type { MetaFieldPrimaryType } from "../internal/entity/types/metadata.js";
import {
  stageField,
  stagePrimaryKey,
  stageVersionKey,
} from "../internal/entity/metadata/stage-metadata.js";

/**
 * Marker that combines `@Field`, `@PrimaryKey`, and `@VersionKey` in one decorator. It
 * declares the column type and marks the field as a primary/version key, but does NOT
 * generate the value — pair it with `@Generated(...)` to produce values.
 *
 * - `@VersionKeyField()` — UUID version key column (default)
 * - `@VersionKeyField("integer")` — integer version key column
 */
export const VersionKeyField =
  (type: MetaFieldPrimaryType = "uuid", options: NamedDecoratorOptions = {}) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    const key = String(context.name);
    stageField(context.metadata, {
      key,
      decorator: "Field",
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
      type,
    });
    stagePrimaryKey(context.metadata, { key });
    stageVersionKey(context.metadata, { key });
  };
