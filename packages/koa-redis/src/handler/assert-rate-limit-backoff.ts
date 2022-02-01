import { ClientError } from "@lindorm-io/errors";
import { RedisContext } from "../types";
import { getRateLimitBackoffExpireKey } from "../util";

interface Options {
  keyName: string;
  value: string;
}

export const assertRateLimitBackoff = async (
  ctx: RedisContext,
  options: Options,
): Promise<void> => {
  const {
    connection: { redis },
  } = ctx;

  const { keyName, value } = options;
  const key = getRateLimitBackoffExpireKey(keyName, value);

  const client = await redis.client();
  const expireTTL = await client.ttl(key);

  if (expireTTL && expireTTL > 0) {
    throw new ClientError("Rate Limit", {
      statusCode: ClientError.StatusCode.TOO_MANY_REQUESTS,
      data: { expiresIn: expireTTL },
    });
  }
};
