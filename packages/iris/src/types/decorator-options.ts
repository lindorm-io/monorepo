import type { MetaFieldDefault, MetaTransform } from "#internal/message/types/types";

export type FieldDecoratorOptions = {
  default?: MetaFieldDefault | null;
  nullable?: boolean;
  optional?: boolean;
  transform?: MetaTransform | null;
};

export type GeneratedDecoratorOptions = {
  length?: number | null;
  max?: number | null;
  min?: number | null;
};

export type MessageDecoratorOptions = {
  name?: string;
};

export type RetryDecoratorOptions = {
  maxRetries?: number;
  strategy?: "constant" | "linear" | "exponential";
  delay?: number;
  delayMax?: number;
  multiplier?: number;
  jitter?: boolean;
};
