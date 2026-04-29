import type { UniqueDecoratorOptions } from "../internal/entity/types/decorators.js";
import { stageUnique } from "../internal/entity/metadata/stage-metadata.js";

/**
 * Declare a unique constraint on one or more fields.
 *
 * - `@Unique()` — field-level: unique constraint on a single field
 * - `@Unique(["email", "tenantId"])` — class-level: composite unique constraint
 * - `@Unique({ name: "uq_custom" })` — custom constraint name
 */
export function Unique(
  options?: UniqueDecoratorOptions,
): (target: undefined, context: ClassFieldDecoratorContext) => void;
export function Unique<T extends abstract new (...args: any[]) => any>(
  keys: Array<keyof InstanceType<T>>,
  options?: UniqueDecoratorOptions,
): (target: T, context: ClassDecoratorContext<T>) => void;
export function Unique(arg1?: any, arg2?: any): any {
  return (_target: any, context: DecoratorContext) => {
    if (context.kind === "field") {
      const options = arg1 as UniqueDecoratorOptions | undefined;
      stageUnique(context.metadata, {
        keys: [String(context.name)],
        name: options?.name ?? null,
      });
    } else if (context.kind === "class") {
      const keys = arg1 as Array<string>;
      const options = (arg2 ?? {}) as UniqueDecoratorOptions;
      stageUnique(context.metadata, {
        keys: keys.map(String),
        name: options.name ?? null,
      });
    }
  };
}
