import { RetryOptions } from "../types";

export const calculateRetry = (
  attempt: number,
  options: Partial<RetryOptions> = {},
): number => {
  const { strategy = "exponential", timeout = 100, timeoutMax = 10000 } = options;

  if (strategy === "linear") {
    const value = timeout * attempt;
    return value > timeoutMax ? timeoutMax : value;
  }

  if (strategy === "constant") {
    return timeout > timeoutMax ? timeoutMax : timeout;
  }

  let value = timeout;

  for (let i = 1; i < attempt; i++) {
    value = value * 2;
  }

  return value > timeoutMax ? timeoutMax : value;
};
