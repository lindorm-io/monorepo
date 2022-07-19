import { MAXIMUM_RATE_LIMIT_ATTEMPTS, MAXIMUM_RATE_LIMIT_EXPIRY } from "../constant";
import { DefaultLindormRedisContext } from "../types";
import {
  getRateLimitBackoffAttemptKey,
  getRateLimitBackoffExpireKey,
  getRateLimitBackoffRetrySeconds,
} from "../util";

interface Options {
  keyName: string;
  value: string;
}

interface Result {
  retriesLeft?: number;
  retryIn?: number;
}

export const setRateLimitBackoff = async (
  ctx: DefaultLindormRedisContext,
  options: Options,
): Promise<Result> => {
  const {
    connection: { redis },
  } = ctx;

  await redis.connect();

  const { keyName, value } = options;

  const attemptKey = getRateLimitBackoffAttemptKey(keyName, value);
  const expireKey = getRateLimitBackoffExpireKey(keyName, value);

  const current = await redis.client.get(attemptKey);

  let attempt: number;

  if (!current) {
    await redis.client.setex(attemptKey, MAXIMUM_RATE_LIMIT_EXPIRY, 1);
    attempt = 1;
  } else {
    attempt = await redis.client.incr(attemptKey);
  }

  const retriesLeft = MAXIMUM_RATE_LIMIT_ATTEMPTS - attempt;

  if (retriesLeft >= 1) {
    return { retriesLeft };
  }

  const retryIn = getRateLimitBackoffRetrySeconds(attempt);
  await redis.client.setex(expireKey, retryIn, 1);

  return { retryIn };
};
