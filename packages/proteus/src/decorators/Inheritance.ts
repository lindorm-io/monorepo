import type { InheritanceStrategy } from "#internal/entity/types/inheritance";
import { stageInheritance } from "#internal/entity/metadata/stage-metadata";

/**
 * Declare this entity as the root of an inheritance hierarchy.
 *
 * - `@Inheritance()` — defaults to "single-table"
 * - `@Inheritance("single-table")` — all subtypes share one table with a discriminator column
 * - `@Inheritance("joined")` — each subtype gets its own table, joined by primary key
 */
export const Inheritance =
  (strategy: InheritanceStrategy = "single-table") =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageInheritance(context.metadata, strategy);
  };
