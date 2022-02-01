import { MAXIMUM_RATE_LIMIT_ATTEMPTS, MAXIMUM_RATE_LIMIT_EXPIRY } from "../constant";
import { RedisContext } from "../types";
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

export const setRateLimitBackoff = async (ctx: RedisContext, options: Options): Promise<Result> => {
  const {
    connection: { redis },
  } = ctx;

  const { keyName, value } = options;

  const attemptKey = getRateLimitBackoffAttemptKey(keyName, value);
  const expireKey = getRateLimitBackoffExpireKey(keyName, value);

  const client = await redis.client();
  const current = await client.get(attemptKey);

  let attempt: number;

  if (!current) {
    await client.setex(attemptKey, MAXIMUM_RATE_LIMIT_EXPIRY, 1);
    attempt = 1;
  } else {
    attempt = await client.incr(attemptKey);
  }

  const retriesLeft = MAXIMUM_RATE_LIMIT_ATTEMPTS - attempt;

  if (retriesLeft >= 1) {
    return { retriesLeft };
  }

  const retryIn = getRateLimitBackoffRetrySeconds(attempt);
  await client.setex(expireKey, retryIn, 1);

  return { retryIn };
};
