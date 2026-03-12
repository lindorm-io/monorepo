import type { NamedDecoratorOptions } from "#internal/entity/types/decorators";
import { stageField } from "#internal/entity/metadata/stage-metadata";

export type ScopeFieldDecoratorOptions = NamedDecoratorOptions & {
  /**
   * Explicit ordering for scope field composition.
   * Lower numbers come first. Fields without `order` are sorted alphabetically
   * after all explicitly ordered fields.
   */
  order?: number;
};

/**
 * Declare a scope field used for multi-tenancy or logical partitioning.
 *
 * Scope fields serve two purposes:
 *
 * 1. **Driver-level key composition** -- in Redis (and similar key-value drivers),
 *    scope fields determine the key prefix structure. The `order` option controls
 *    the ordering of scope fields in the composed key (lowest first, alphabetical
 *    fallback for unordered fields).
 *
 * 2. **Automatic query filtering** -- all scope fields are auto-registered as a
 *    `__scope` system filter via the `@Filter` infrastructure. Every find/count/exists
 *    query automatically includes a WHERE condition for each scope field, ensuring
 *    queries are scoped by default. Disable for a single query with
 *    `{ withoutScope: true }` in FindOptions.
 *
 * Scope fields are read-only, non-nullable strings with a minimum length of 1.
 */
export const ScopeField =
  (options: ScopeFieldDecoratorOptions = {}) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageField(context.metadata, {
      key: String(context.name),
      decorator: "Scope",
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
      min: 1,
      name: options.name ?? String(context.name),
      nullable: false,
      order: options.order ?? null,
      precision: null,
      readonly: true,
      scale: null,
      schema: null,
      transform: null,
      type: "string",
    });
  };
