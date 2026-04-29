import { stageDefaultOrder } from "../internal/entity/metadata/stage-metadata.js";

/**
 * Set a default ordering for queries against this entity.
 *
 * Applied when `FindOptions.order` is not provided. Explicit `order` in
 * FindOptions or `.orderBy()` on the QueryBuilder takes precedence.
 *
 * - `@DefaultOrder({ createdAt: "DESC" })`
 * - `@DefaultOrder({ lastName: "ASC", firstName: "ASC" })`
 */
export const DefaultOrder =
  (order: Record<string, "ASC" | "DESC">) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageDefaultOrder(context.metadata, order);
  };
