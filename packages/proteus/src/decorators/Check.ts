import type { CheckDecoratorOptions } from "../internal/entity/types/decorators";
import { stageCheck } from "../internal/entity/metadata/stage-metadata";

/**
 * Declare a CHECK constraint on the entity table.
 *
 * @param expression - Raw SQL boolean expression (e.g. `"price >= 0"`).
 * @param options.name - Custom constraint name. Auto-generated if omitted.
 */
export const Check =
  (expression: string, options: CheckDecoratorOptions = {}) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageCheck(context.metadata, {
      expression,
      name: options.name ?? null,
    });
  };
