import { readableSeconds } from "@lindorm-io/readable-time";

export const MAXIMUM_RATE_LIMIT_ATTEMPTS = 5;
export const MAXIMUM_RATE_LIMIT_EXPIRY = readableSeconds("60m");

export const RATE_LIMIT_KEY_PREFIX = "rate-limit";
export const RATE_LIMIT_BACKOFF_ATTEMPT_PREFIX = "rate-limit-backoff-attempt";
export const RATE_LIMIT_BACKOFF_EXPIRE_PREFIX = "rate-limit-backoff-expire";
