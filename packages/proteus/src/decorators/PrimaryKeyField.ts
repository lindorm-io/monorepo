import type { NamedDecoratorOptions } from "#internal/entity/types/decorators";
import type { MetaFieldPrimaryType } from "#internal/entity/types/metadata";
import {
  stageField,
  stageGenerated,
  stagePrimaryKey,
} from "#internal/entity/metadata/stage-metadata";

/**
 * Shorthand that combines `@Field`, `@PrimaryKey`, and `@Generated` in one decorator.
 *
 * - `@PrimaryKeyField()` — UUID primary key (default)
 * - `@PrimaryKeyField("integer")` — auto-increment integer primary key
 * - `@PrimaryKeyField("string", { name: "pk" })` — random string PK with custom column name
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
    stageGenerated(context.metadata, {
      key,
      strategy: type === "integer" ? "increment" : type === "uuid" ? "uuid" : "string",
      length: null,
      max: null,
      min: null,
    });
  };
