import { DefaultLindormRedisContext } from "../types";
import { getRateLimitBackoffAttemptKey } from "../util";

interface Options {
  keyName: string;
  value: string;
}

export const clearRateLimitBackoff = async (
  ctx: DefaultLindormRedisContext,
  options: Options,
): Promise<void> => {
  const {
    connection: { redis },
  } = ctx;

  const { keyName, value } = options;
  const key = getRateLimitBackoffAttemptKey(keyName, value);

  await redis.waitForConnection();
  const client = redis.client();
  await client.del(key);
};
