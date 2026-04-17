import type { MetaGeneratedStrategy } from "../internal/message/types/types";
import { stageGenerated } from "../internal/message/metadata/stage-metadata";
import type { GeneratedDecoratorOptions } from "../types/decorator-options";

export const Generated =
  (strategy: MetaGeneratedStrategy, options: GeneratedDecoratorOptions = {}) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageGenerated(context.metadata, {
      key: String(context.name),
      strategy,
      length: options.length ?? null,
      max: options.max ?? null,
      min: options.min ?? null,
    });
  };
