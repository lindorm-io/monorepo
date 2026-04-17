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
