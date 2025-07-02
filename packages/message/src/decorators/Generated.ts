import { isObject, isString } from "@lindorm/is";
import { GeneratedDecoratorOptions, MetaGeneratedStrategy } from "../types";
import { globalMessageMetadata } from "../utils";

export function Generated(
  strategy: MetaGeneratedStrategy,
  options?: Omit<GeneratedDecoratorOptions, "strategy">,
): PropertyDecorator;
export function Generated(options?: GeneratedDecoratorOptions): PropertyDecorator;
export function Generated(arg1?: any, arg2?: any): PropertyDecorator {
  return function (target, key) {
    const options = isObject(arg1)
      ? (arg1 as GeneratedDecoratorOptions)
      : ((arg2 ?? {}) as GeneratedDecoratorOptions);
    const strategy = isString(arg1) ? (arg1 as MetaGeneratedStrategy) : options.strategy;
    if (!strategy) {
      throw new Error("Generated strategy is required");
    }
    globalMessageMetadata.addGenerated({
      target: target.constructor,
      key: key as string,
      length: options.length ?? null,
      max: options.max ?? null,
      min: options.min ?? null,
      strategy,
    });
  };
}
