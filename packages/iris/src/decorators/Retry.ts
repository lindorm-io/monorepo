import { stageRetry } from "../internal/message/metadata/stage-metadata.js";
import type { RetryDecoratorOptions } from "../types/decorator-options.js";

export const Retry =
  (options: RetryDecoratorOptions = {}) =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageRetry(context.metadata, {
      maxRetries: options.maxRetries ?? 3,
      strategy: options.strategy ?? "constant",
      delay: options.delay ?? 1000,
      delayMax: options.delayMax ?? 30000,
      multiplier: options.multiplier ?? 2,
      jitter: options.jitter ?? false,
    });
  };
