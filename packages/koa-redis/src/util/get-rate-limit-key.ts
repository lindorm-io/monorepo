import {
  RATE_LIMIT_BACKOFF_ATTEMPT_PREFIX,
  RATE_LIMIT_BACKOFF_EXPIRE_PREFIX,
  RATE_LIMIT_KEY_PREFIX,
} from "../constant";

export const getRateLimitKey = (keyName: string, value: string): string =>
  `${RATE_LIMIT_KEY_PREFIX}::${keyName}::${value}`;

export const getRateLimitBackoffAttemptKey = (keyName: string, value: string): string =>
  `${RATE_LIMIT_BACKOFF_ATTEMPT_PREFIX}::${keyName}::${value}`;

export const getRateLimitBackoffExpireKey = (keyName: string, value: string): string =>
  `${RATE_LIMIT_BACKOFF_EXPIRE_PREFIX}::${keyName}::${value}`;
