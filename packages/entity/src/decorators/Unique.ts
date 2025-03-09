/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { UniqueDecoratorOptions } from "../types";
import { globalEntityMetadata } from "../utils";

export function Unique(
  keys: Array<string>,
  options?: UniqueDecoratorOptions,
): ClassDecorator;
export function Unique(options?: UniqueDecoratorOptions): PropertyDecorator;
export function Unique(arg1?: any, arg2?: any): ClassDecorator | PropertyDecorator {
  return function (target, key) {
    if (key) {
      const options = (arg1 ?? {}) as UniqueDecoratorOptions;
      globalEntityMetadata.addUnique({
        target: target.constructor,
        keys: [key as string],
        name: options.name ?? null,
      });
    } else {
      const keys = arg1 as Array<string>;
      const options = (arg2 ?? {}) as UniqueDecoratorOptions;
      globalEntityMetadata.addUnique({
        target: target as Function,
        keys,
        name: options.name ?? null,
      });
    }
  };
}
