import { isArray, isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { IndexDecoratorOptions } from "../internal/entity/types/decorators.js";
import type { IndexDirection } from "../internal/types/types.js";
import { stageIndex } from "../internal/entity/metadata/stage-metadata.js";

/**
 * Declare a database index on one or more fields.
 *
 * - `@Index()` — field-level: ascending index on a single field
 * - `@Index("desc")` — field-level: descending index
 * - `@Index(["name", "email"])` — class-level: composite index
 * - `@Index({ name: "asc", email: "desc" })` — class-level: composite with per-field direction
 * - `@Index({ unique: true })` — unique index
 * - `@Index({ where: "active = true" })` — partial index
 * - `@Index({ using: "gin" })` — custom index method
 */
export function Index(
  direction?: IndexDirection,
  options?: Omit<IndexDecoratorOptions, "direction">,
): (target: undefined, context: ClassFieldDecoratorContext) => void;
export function Index(
  options?: IndexDecoratorOptions,
): (target: undefined, context: ClassFieldDecoratorContext) => void;
export function Index<T extends abstract new (...args: any[]) => any>(
  index: Array<keyof InstanceType<T>>,
  options?: Omit<IndexDecoratorOptions, "direction">,
): (target: T, context: ClassDecoratorContext<T>) => void;
export function Index<T extends abstract new (...args: any[]) => any>(
  index: { [K in keyof InstanceType<T>]?: IndexDirection },
  options?: IndexDecoratorOptions,
): (target: T, context: ClassDecoratorContext<T>) => void;
export function Index(arg1?: any, arg2?: any): any {
  return (_target: any, context: DecoratorContext) => {
    if (context.kind === "field") {
      const options = isObject(arg1)
        ? (arg1 as IndexDecoratorOptions)
        : ((arg2 ?? {}) as IndexDecoratorOptions);
      const direction = isObject(arg1) ? arg1.direction : (arg1 as IndexDirection);
      stageIndex(context.metadata, {
        keys: [{ key: String(context.name), direction: direction ?? "asc", nulls: null }],
        include: null,
        name: options.name ?? null,
        unique: options.unique ?? false,
        concurrent: options.concurrent ?? false,
        sparse: options.sparse ?? false,
        where: options.where ?? null,
        using: options.using ?? null,
        with: options.with ?? null,
      });
    } else if (context.kind === "class") {
      const index = arg1 as Array<string> | Dict<IndexDirection>;
      const options = (arg2 ?? {}) as IndexDecoratorOptions;
      stageIndex(context.metadata, {
        keys: isObject<Dict<IndexDirection>>(index)
          ? Object.entries(index).map(([key, direction]) => ({
              key,
              direction,
              nulls: null,
            }))
          : isArray(index)
            ? index.map((key) => ({
                key,
                direction: options.direction ?? "asc",
                nulls: null,
              }))
            : [],
        include: null,
        name: options.name ?? null,
        unique: options.unique ?? false,
        concurrent: options.concurrent ?? false,
        sparse: options.sparse ?? false,
        where: options.where ?? null,
        using: options.using ?? null,
        with: options.with ?? null,
      });
    }
  };
}
