import type { MetaGeneratedStrategy } from "../internal/message/types/types.js";
import { stageGenerated } from "../internal/message/metadata/stage-metadata.js";
import type { GeneratedDecoratorOptions } from "../types/decorator-options.js";

type GeneratedDecorator = (
  _target: undefined,
  context: ClassFieldDecoratorContext,
) => void;

export function Generated(): GeneratedDecorator;
export function Generated(
  strategy: MetaGeneratedStrategy,
  options?: GeneratedDecoratorOptions,
): GeneratedDecorator;
export function Generated(generator: () => unknown): GeneratedDecorator;
export function Generated(
  strategyOrGenerator?: MetaGeneratedStrategy | (() => unknown),
  options: GeneratedDecoratorOptions = {},
): GeneratedDecorator {
  const generator =
    typeof strategyOrGenerator === "function" ? strategyOrGenerator : null;
  const strategy = generator
    ? null
    : ((strategyOrGenerator ?? "lindorm_id") as MetaGeneratedStrategy);

  return (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageGenerated(context.metadata, {
      key: String(context.name),
      generator,
      strategy,
      length: options.length ?? null,
      max: options.max ?? null,
      min: options.min ?? null,
    });
  };
}
