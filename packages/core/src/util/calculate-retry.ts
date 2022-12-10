import { RetryStrategy } from "../enum";

type Options = {
  maximum: number;
  milliseconds: number;
  strategy: RetryStrategy;
};

export const calculateRetry = (attempt: number, options: Partial<Options> = {}): number => {
  const { maximum = 30000, milliseconds = 500, strategy = RetryStrategy.LINEAR } = options;

  if (strategy === RetryStrategy.LINEAR) {
    return milliseconds * attempt;
  }

  let value = milliseconds;

  for (let i = 1; i < attempt; i++) {
    value = value * 2;
  }

  return value > maximum ? maximum : value;
};
