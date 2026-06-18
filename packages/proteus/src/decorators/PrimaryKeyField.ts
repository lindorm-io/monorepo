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
 * - `@PrimaryKeyField()` — type-less PK marker; pair with `@Generated(...)` to infer the column type
 * - `@PrimaryKeyField("uuid")` — uuid primary key column
 * - `@PrimaryKeyField("integer")` — integer primary key column
 * - `@PrimaryKeyField("string", { name: "pk" })` — string PK column with custom column name
 *
 * When `type` is omitted, the column type is inferred from the paired `@Generated(...)`
 * (`@Generated()` → varchar(24), `@Generated("uuid")` → uuid, `@Generated("increment")` → integer).
 * A bare `@PrimaryKeyField()` with no `@Generated` and no type surfaces a metadata error.
 */
export const PrimaryKeyField =
  (type?: MetaFieldPrimaryType, options: NamedDecoratorOptions = {}) =>
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
      type: type ?? null,
    });
    stagePrimaryKey(context.metadata, { key });
  };
