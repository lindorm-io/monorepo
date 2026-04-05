import type { Dict, Predicate } from "@lindorm/types";
import { stageFilter } from "#internal/entity/metadata/stage-metadata";

/**
 * Options for the @Filter decorator.
 */
export type FilterDecoratorOptions = {
  /** Unique name for this filter (e.g. "active", "tenant"). */
  name: string;
  /**
   * Filter condition using Predicate operators.
   * Use `"$paramName"` string placeholders for parameterized values
   * that are resolved at query time via `setFilterParams()` or `FindOptions.filters`.
   */
  condition: Predicate<Dict>;
  /**
   * When `true`, the filter is auto-enabled on every query.
   * When `false` (default), the filter must be explicitly enabled per query.
   */
  default?: boolean;
};

/**
 * Declare a parameterized WHERE-clause filter on this entity.
 *
 * Filters are named, reusable predicates that can be enabled/disabled
 * per-source or per-query. Use `$paramName` placeholders in the condition
 * for values supplied at runtime.
 *
 * @example
 * ```ts
 * @Entity()
 * @Filter({ name: "active", condition: { deletedAt: null }, default: true })
 * @Filter({ name: "tenant", condition: { tenantId: "$tenantId" } })
 * class Invoice {
 *   @PrimaryKeyField() id!: string;
 *   @Field("string") tenantId!: string;
 *   @DeleteDateField() deletedAt!: Date | null;
 * }
 * ```
 */
export const Filter =
  (options: FilterDecoratorOptions) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageFilter(context.metadata, {
      name: options.name,
      condition: options.condition,
      default: options.default ?? false,
    });
  };
