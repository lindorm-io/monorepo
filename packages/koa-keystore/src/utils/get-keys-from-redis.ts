import { WebKeySet } from "@lindorm-io/jwk";
import { DefaultLindormKeystoreContext } from "../types";

export const getKeysFromRedis = async (
  ctx: DefaultLindormKeystoreContext,
): Promise<Array<WebKeySet>> => {
  const keys = await ctx.redis.storedKeySetRedisRepository.findMany({});

  ctx.logger.debug("Keys found in redis cache", {
    amount: keys.length,
  });

  return keys.map((key) => key.webKeySet);
};
