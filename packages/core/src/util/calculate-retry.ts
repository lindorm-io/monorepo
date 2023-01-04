import { RetryOptions } from "../types";

export const calculateRetry = (attempt: number, options: Partial<RetryOptions> = {}): number => {
  const { maximumMilliseconds = 30000, milliseconds = 500, strategy = "linear" } = options;

  if (strategy === "linear") {
    return milliseconds * attempt;
  }

  let value = milliseconds;

  for (let i = 1; i < attempt; i++) {
    value = value * 2;
  }

  return value > maximumMilliseconds ? maximumMilliseconds : value;
};
