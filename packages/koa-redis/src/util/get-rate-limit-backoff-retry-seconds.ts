import { stringSeconds } from "@lindorm-io/expiry";
import { MAXIMUM_RATE_LIMIT_ATTEMPTS, MAXIMUM_RATE_LIMIT_EXPIRY } from "../constant";

export const getRateLimitBackoffRetrySeconds = (currentValue: number): number => {
  if (currentValue < MAXIMUM_RATE_LIMIT_ATTEMPTS) {
    return 0;
  }

  if (currentValue === MAXIMUM_RATE_LIMIT_ATTEMPTS) {
    return stringSeconds("1m");
  }

  if (currentValue === MAXIMUM_RATE_LIMIT_ATTEMPTS + 1) {
    return stringSeconds("3m");
  }

  if (currentValue === MAXIMUM_RATE_LIMIT_ATTEMPTS + 2) {
    return stringSeconds("5m");
  }

  if (currentValue === MAXIMUM_RATE_LIMIT_ATTEMPTS + 3) {
    return stringSeconds("15m");
  }

  if (currentValue === MAXIMUM_RATE_LIMIT_ATTEMPTS + 4) {
    return stringSeconds("30m");
  }

  return MAXIMUM_RATE_LIMIT_EXPIRY;
};
