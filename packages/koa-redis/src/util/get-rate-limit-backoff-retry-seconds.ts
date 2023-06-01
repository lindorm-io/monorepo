import { readableSeconds } from "@lindorm-io/readable-time";
import { MAXIMUM_RATE_LIMIT_ATTEMPTS, MAXIMUM_RATE_LIMIT_EXPIRY } from "../constant";

export const getRateLimitBackoffRetrySeconds = (currentValue: number): number => {
  if (currentValue < MAXIMUM_RATE_LIMIT_ATTEMPTS) {
    return 0;
  }

  if (currentValue === MAXIMUM_RATE_LIMIT_ATTEMPTS) {
    return readableSeconds("1m");
  }

  if (currentValue === MAXIMUM_RATE_LIMIT_ATTEMPTS + 1) {
    return readableSeconds("3m");
  }

  if (currentValue === MAXIMUM_RATE_LIMIT_ATTEMPTS + 2) {
    return readableSeconds("5m");
  }

  if (currentValue === MAXIMUM_RATE_LIMIT_ATTEMPTS + 3) {
    return readableSeconds("15m");
  }

  if (currentValue === MAXIMUM_RATE_LIMIT_ATTEMPTS + 4) {
    return readableSeconds("30m");
  }

  return MAXIMUM_RATE_LIMIT_EXPIRY;
};
