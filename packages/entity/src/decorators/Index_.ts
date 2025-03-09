/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { isArray } from "@lindorm/is";
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
export function Index(arg1?: any, arg2?: any): ClassDecorator | PropertyDecorator {
  return function (target, key) {
    if (key) {
      const direction = arg1 as IndexDirection | undefined;
      const options = (arg2 ?? {}) as IndexDecoratorOptions;
      globalEntityMetadata.addIndex({
        target: target.constructor,
        index: { [key as string]: direction ?? "asc" },
        name: options.name ?? null,
        options: options.options ?? {},
      });
    } else {
      const index = arg1 as Array<string> | Dict<IndexDirection>;
      const options = (arg2 ?? {}) as IndexDecoratorOptions;
      globalEntityMetadata.addIndex({
        target: target as Function,
        index: isArray<string>(index)
          ? index.reduce(
              (acc, key) => ({ ...acc, [key]: options.direction ?? "asc" }),
              {},
            )
          : index,
        name: options.name ?? null,
        options: options.options ?? {},
      });
    }
  };
}
