import { DefaultLindormRedisContext } from "../types";
import { getRateLimitKey } from "../util";
import { ClientError } from "@lindorm-io/errors";

interface Options {
  expiresInSeconds: number;
  keyName: string;
  limit: number;
  value: string;
}

export const assertRateLimit = async (
  ctx: DefaultLindormRedisContext,
  options: Options,
): Promise<void> => {
  const {
    connection: { redis },
  } = ctx;

  await redis.connect();

  const { expiresInSeconds, keyName, limit, value } = options;
  const key = getRateLimitKey(keyName, value);
  const currentNum = await redis.client.get(key);

  if (currentNum) {
    const newNum = await redis.client.incr(key);

    if (newNum >= limit) {
      const retryIn = await redis.client.ttl(key);

      throw new ClientError("Rate Limit", {
        statusCode: ClientError.StatusCode.TOO_MANY_REQUESTS,
        data: { retryIn },
      });
    }
  } else {
    await redis.client.setex(key, expiresInSeconds, 1);
  }
};
