import type { DelayOptions } from "../types/index.js";

export const computeDelay = (attempt: number, options: DelayOptions = {}): number => {
  const {
    strategy = "exponential",
    delay = 100,
    delayMax = 30000,
    multiplier = 2,
    jitter = false,
  } = options;

  let value: number;

  if (strategy === "constant") {
    value = delay;
  } else if (strategy === "linear") {
    value = delay * attempt;
  } else {
    value = delay * Math.pow(multiplier, attempt - 1);
  }

  const capped = Math.min(value, delayMax);

  if (!jitter) return capped;

  return Math.round(capped * (0.5 + Math.random() * 0.5));
};
