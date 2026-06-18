import type { NamedDecoratorOptions } from "../internal/entity/types/decorators.js";
import type { MetaFieldPrimaryType } from "../internal/entity/types/metadata.js";
import {
  stageField,
  stagePrimaryKey,
} from "../internal/entity/metadata/stage-metadata.js";

/**
 * Marker that combines `@Field` and `@PrimaryKey` in one decorator. It declares the
 * column type and marks the field as the primary key, but does NOT generate the value —
 * pair it with `@Generated(...)` to produce values.
 *
 * - `@PrimaryKeyField()` — UUID primary key column (default)
 * - `@PrimaryKeyField("integer")` — integer primary key column
 * - `@PrimaryKeyField("string", { name: "pk" })` — string PK column with custom column name
 */
export const PrimaryKeyField =
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
  };
