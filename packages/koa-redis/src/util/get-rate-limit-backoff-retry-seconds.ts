import { MAXIMUM_RATE_LIMIT_ATTEMPTS, MAXIMUM_RATE_LIMIT_EXPIRY } from "../constant";
import { stringToSeconds } from "@lindorm-io/expiry";

export const getRateLimitBackoffRetrySeconds = (currentValue: number): number => {
  if (currentValue < MAXIMUM_RATE_LIMIT_ATTEMPTS) {
    return 0;
  }

  if (currentValue === MAXIMUM_RATE_LIMIT_ATTEMPTS) {
    return stringToSeconds("1 minutes");
  }

  if (currentValue === MAXIMUM_RATE_LIMIT_ATTEMPTS + 1) {
    return stringToSeconds("3 minutes");
  }

  if (currentValue === MAXIMUM_RATE_LIMIT_ATTEMPTS + 2) {
    return stringToSeconds("5 minutes");
  }

  if (currentValue === MAXIMUM_RATE_LIMIT_ATTEMPTS + 3) {
    return stringToSeconds("15 minutes");
  }

  if (currentValue === MAXIMUM_RATE_LIMIT_ATTEMPTS + 4) {
    return stringToSeconds("30 minutes");
  }

  return MAXIMUM_RATE_LIMIT_EXPIRY;
};
