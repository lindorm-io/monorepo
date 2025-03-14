/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { isArray, isObject } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { IndexDecoratorOptions, IndexDirection } from "../types";
import { globalEntityMetadata } from "../utils";

export function Index(
  index: Array<string>,
  options?: Omit<IndexDecoratorOptions, "direction">,
): ClassDecorator;
export function Index(
  index: Dict<IndexDirection>,
  options?: IndexDecoratorOptions,
): ClassDecorator;
export function Index(
  direction?: IndexDirection,
  options?: Omit<IndexDecoratorOptions, "direction">,
): PropertyDecorator;
export function Index(options?: IndexDecoratorOptions): PropertyDecorator;
export function Index(arg1?: any, arg2?: any): ClassDecorator | PropertyDecorator {
  return function (target, key) {
    if (key) {
      const options = isObject(arg1)
        ? (arg1 as IndexDecoratorOptions)
        : ((arg2 ?? {}) as IndexDecoratorOptions);
      const direction = isObject(arg1) ? arg1.direction : (arg1 as IndexDirection);
      globalEntityMetadata.addIndex({
        target: target.constructor,
        keys: [{ key: key.toString(), direction: direction ?? "asc" }],
        name: options.name ?? null,
        options: options.options ?? {},
        unique: options.unique ?? false,
      });
    } else {
      const index = arg1 as Array<string> | Dict<IndexDirection>;
      const options = (arg2 ?? {}) as IndexDecoratorOptions;
      globalEntityMetadata.addIndex({
        target: target as Function,
        keys: isObject<Dict<IndexDirection>>(index)
          ? Object.entries(index).map(([key, direction]) => ({ key, direction }))
          : isArray(index)
            ? index.map((key) => ({
                key,
                direction: options.direction ?? "asc",
              }))
            : [],
        name: options.name ?? null,
        options: options.options ?? {},
        unique: options.unique ?? false,
      });
    }
  };
}
