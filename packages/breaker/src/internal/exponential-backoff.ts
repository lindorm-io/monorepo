export type BackoffConfig = {
  baseDelay: number;
  multiplier: number;
  maxDelay: number;
};

export const calculateBackoff = (config: BackoffConfig, attempts: number): number => {
  const delay = config.baseDelay * Math.pow(config.multiplier, attempts);
  return Math.min(delay, config.maxDelay);
};
