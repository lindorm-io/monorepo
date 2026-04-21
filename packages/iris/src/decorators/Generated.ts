import type { MetaGeneratedStrategy } from "../internal/message/types/types.js";
import { stageGenerated } from "../internal/message/metadata/stage-metadata.js";
import type { GeneratedDecoratorOptions } from "../types/decorator-options.js";

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
