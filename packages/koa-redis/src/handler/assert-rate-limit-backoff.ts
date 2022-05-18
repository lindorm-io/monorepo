import { ClientError } from "@lindorm-io/errors";
import { DefaultLindormRedisContext } from "../types";
import { getRateLimitBackoffExpireKey } from "../util";

interface Options {
  keyName: string;
  value: string;
}

export const assertRateLimitBackoff = async (
  ctx: DefaultLindormRedisContext,
  options: Options,
): Promise<void> => {
  const {
    connection: { redis },
  } = ctx;

  const { keyName, value } = options;
  const key = getRateLimitBackoffExpireKey(keyName, value);

  await redis.waitForConnection();
  const client = redis.client();
  const expireTTL = await client.ttl(key);

  if (expireTTL && expireTTL > 0) {
    throw new ClientError("Rate Limit", {
      statusCode: ClientError.StatusCode.TOO_MANY_REQUESTS,
      data: { expiresIn: expireTTL },
    });
  }
};
