import type { CheckDecoratorOptions } from "../internal/entity/types/decorators.js";
import { stageCheck } from "../internal/entity/metadata/stage-metadata.js";

/**
 * Declare a CHECK constraint on the entity table.
 *
 * @param expression - Raw SQL boolean expression (e.g. `"price >= 0"`).
 * @param options.name - Custom constraint name. When omitted, `name` is staged as
 *   `null` and each SQL driver generates `chk_<hash>` at DDL time. This is a
 *   deliberate exception to "resolve defaults into explicit metadata": the name
 *   depends on the resolved table name (naming strategy) and a driver-specific
 *   identifier hash with per-driver length limits — context that does not exist
 *   at decoration or metadata-build time.
 */
export const Check =
  (expression: string, options: CheckDecoratorOptions = {}) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageCheck(context.metadata, {
      expression,
      name: options.name ?? null,
    });
  };
